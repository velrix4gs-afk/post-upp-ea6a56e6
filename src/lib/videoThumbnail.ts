/**
 * Client-side video thumbnail generation.
 *
 * POST-UPP stores videos with no poster image, so a feed video renders as a
 * black box until the user taps play. This module captures a frame from the
 * video and caches it, so a poster is available instantly on later renders.
 *
 * Two cache layers, cheapest first:
 *   1. in-memory Map  — instant, same session
 *   2. localStorage   — survives reloads (data URLs, capped count)
 *
 * The generated frame is never uploaded; it is a display-only convenience.
 * If capture fails (codec, CORS, autoplay policy) we resolve to null and the
 * caller falls back to the existing placeholder — nothing breaks.
 */

const MEMORY = new Map<string, string>();
const STORAGE_PREFIX = 'postupp:vthumb:';
const MAX_STORED = 60;

/** Rough cap so localStorage does not fill up (5MB budget). */
const MAX_DATA_URL_CHARS = 60_000;

const storageAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

const readStored = (key: string): string | null => {
  if (!storageAvailable()) return null;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
};

/**
 * Writes a thumbnail, evicting the oldest entries when over the cap.
 * Keys carry an insertion timestamp so eviction order is meaningful.
 */
const writeStored = (key: string, dataUrl: string): void => {
  if (!storageAvailable()) return;
  if (dataUrl.length > MAX_DATA_URL_CHARS) return;
  try {
    const stampKey = `${STORAGE_PREFIX}ts:${key}`;
    window.localStorage.setItem(storageKey(key), dataUrl);
    window.localStorage.setItem(stampKey, String(Date.now()));

    // Opportunistic prune
    const stampKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(`${STORAGE_PREFIX}ts:`)) stampKeys.push(k);
    }
    if (stampKeys.length > MAX_STORED) {
      stampKeys
        .sort((a, b) => Number(window.localStorage.getItem(a)) - Number(window.localStorage.getItem(b)))
        .slice(0, stampKeys.length - MAX_STORED)
        .forEach((k) => {
          const realKey = k.replace(`${STORAGE_PREFIX}ts:`, '');
          window.localStorage.removeItem(k);
          window.localStorage.removeItem(storageKey(realKey));
        });
    }
  } catch {
    // Quota or private mode — thumbnails are optional, so give up quietly.
  }
};

const storageKey = (key: string) => STORAGE_PREFIX + key;

/** Cheap stable key for a URL (avoid storing full signed query strings). */
export const thumbKeyFor = (videoUrl: string): string => {
  const withoutQuery = videoUrl.split('?')[0];
  let hash = 0;
  for (let i = 0; i < withoutQuery.length; i += 1) {
    hash = (hash * 31 + withoutQuery.charCodeAt(i)) | 0;
  }
  return `${hash.toString(36)}:${withoutQuery.length}`;
};

/** Returns a cached poster synchronously, or null if none is stored yet. */
export const getCachedThumbnail = (videoUrl: string): string | null => {
  const key = thumbKeyFor(videoUrl);
  const fromMemory = MEMORY.get(key);
  if (fromMemory) return fromMemory;
  const stored = readStored(key);
  if (stored) {
    MEMORY.set(key, stored);
    return stored;
  }
  return null;
};

/**
 * Captures a frame at `seekSeconds` and caches it.
 *
 * Resolves to the data URL, or null when the browser refuses (unsupported
 * codec, cross-origin video without CORS headers, or a blocked decode).
 */
export const generateVideoThumbnail = (
  videoUrl: string,
  seekSeconds = 0.1,
  maxWidth = 720,
): Promise<string | null> => {
  const cached = getCachedThumbnail(videoUrl);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const video = document.createElement('video');
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };

    // Cross-origin frames taint the canvas; only a CORS-enabled source can be
    // read back. Supabase Storage serves `access-control-allow-origin: *`.
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = videoUrl;

    const timeout = window.setTimeout(() => finish(null), 10_000);

    video.addEventListener('error', () => {
      window.clearTimeout(timeout);
      finish(null);
    });

    video.addEventListener('loadeddata', () => {
      // Some encoders report duration 0 until metadata settles.
      const target = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(seekSeconds, Math.max(video.duration - 0.05, 0))
        : 0;
      try {
        video.currentTime = target;
      } catch {
        window.clearTimeout(timeout);
        finish(null);
      }
    });

    video.addEventListener('seeked', () => {
      try {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) {
          window.clearTimeout(timeout);
          finish(null);
          return;
        }
        const scale = Math.min(1, maxWidth / width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          window.clearTimeout(timeout);
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        window.clearTimeout(timeout);
        if (!dataUrl || dataUrl === 'data:,') {
          finish(null);
          return;
        }
        MEMORY.set(thumbKeyFor(videoUrl), dataUrl);
        writeStored(thumbKeyFor(videoUrl), dataUrl);
        finish(dataUrl);
      } catch {
        // Tainted canvas (no CORS) throws here.
        window.clearTimeout(timeout);
        finish(null);
      }
    });
  });
};
