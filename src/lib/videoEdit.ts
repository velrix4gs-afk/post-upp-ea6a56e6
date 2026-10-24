/**
 * Client-side video editing: trim + blur regions.
 * The trimmed range is played through a canvas (blur applied to the chosen regions while
 * their time window is active) and re-recorded with MediaRecorder, together with the original audio.
 * Runs in real time, so a 30s clip takes ~30s to export.
 */
export interface BlurRegion {
  id: string;
  /** Fractions (0-1) of the video frame. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Seconds in the source video during which the blur is applied. */
  from: number;
  to: number;
}

export interface VideoEditPlan {
  start: number;
  end: number;
  regions: BlurRegion[];
  /** Centre-crop to this width/height ratio (e.g. 9/16). null = keep the original frame. */
  cropAspect?: number | null;
}

const pickMime = (): { mime: string; ext: string } => {
  const candidates: Array<[string, string]> = [
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [mime, ext] of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return { mime: '', ext: 'webm' };
};

export const canEditVideo = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' &&
  typeof (HTMLCanvasElement.prototype as any).captureStream === 'function';

const MAX_SIDE = 1280;

export const exportEditedVideo = async (
  file: File,
  plan: VideoEditPlan,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<File> => {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';

  let audioCtx: AudioContext | null = null;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read this video'));
    });

    // Source rectangle (centre crop) → output size
    const vw = video.videoWidth, vh = video.videoHeight;
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (plan.cropAspect) {
      const srcAspect = vw / vh;
      if (srcAspect > plan.cropAspect) { sw = Math.round(vh * plan.cropAspect); sx = Math.round((vw - sw) / 2); }
      else { sh = Math.round(vw / plan.cropAspect); sy = Math.round((vh - sh) / 2); }
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const W = Math.max(2, Math.round((sw * scale) / 2) * 2);
    const H = Math.max(2, Math.round((sh * scale) / 2) * 2);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const supportsFilter = 'filter' in ctx;

    const stream = canvas.captureStream(30);

    // Original audio → recorder only (not the speakers).
    try {
      const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      audioCtx = new Ctx();
      await audioCtx.resume();
      const src = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      src.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch { /* no audio track available — export silent */ }

    const { mime, ext } = pickMime();
    const recorder = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 4_000_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

    video.currentTime = plan.start;
    await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });

    const drawFrame = () => {
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
      const t = video.currentTime;
      for (const r of plan.regions) {
        if (t < r.from || t > r.to) continue;
        const rx = r.x * W, ry = r.y * H, rw = r.w * W, rh = r.h * H;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.clip();
        if (supportsFilter) {
          ctx.filter = `blur(${Math.max(10, Math.round(W / 60))}px)`;
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
        } else {
          // Pixelate fallback for WebViews without canvas filters.
          const px = 24;
          const tw = Math.max(1, Math.round(rw / px)), th = Math.max(1, Math.round(rh / px));
          const tmp = document.createElement('canvas');
          tmp.width = tw; tmp.height = th;
          tmp.getContext('2d')!.drawImage(video, sx + (rx / W) * sw, sy + (ry / H) * sh, (rw / W) * sw, (rh / H) * sh, 0, 0, tw, th);
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(tmp, 0, 0, tw, th, rx, ry, rw, rh);
        }
        ctx.restore();
      }
    };

    recorder.start(250);
    await video.play();

    await new Promise<void>((resolve, reject) => {
      let raf = 0;
      const finish = (err?: Error) => {
        cancelAnimationFrame(raf);
        video.pause();
        err ? reject(err) : resolve();
      };
      const tick = () => {
        if (signal?.aborted) return finish(new Error('cancelled'));
        drawFrame();
        const span = Math.max(0.1, plan.end - plan.start);
        onProgress?.(Math.min(1, (video.currentTime - plan.start) / span));
        if (video.currentTime >= plan.end || video.ended) return finish();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });

    recorder.stop();
    await stopped;
    const type = mime ? mime.split(';')[0] : 'video/webm';
    const base = file.name.replace(/\.[^.]+$/, '') || 'video';
    return new File([new Blob(chunks, { type })], `${base}-edited.${ext}`, { type, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
    try { await audioCtx?.close(); } catch { /* ignore */ }
  }
};
