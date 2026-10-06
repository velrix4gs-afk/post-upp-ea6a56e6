/**
 * Recently-used media, shared across the whole app.
 *
 * The problem this solves: chat, feed, showcase and page composers each open
 * their own picker, so a photo you just used in one place has to be hunted
 * down again in the next. This keeps the most recent picks in one store that
 * every picker reads from, so the thing you just used is the first thing you
 * see — the way a phone's own gallery behaves.
 *
 * Storage: IndexedDB, because it holds real `Blob`s. localStorage would
 * require base64 (≈33% larger, synchronous, 5MB cap) and a photo easily
 * exceeds that.
 *
 * Privacy: entries are capped by both count and total bytes, and expire after
 * a fixed window. This is a convenience cache, never the source of truth — a
 * failure here must never block composing a post, so every call is
 * best-effort and swallows its own errors.
 */

const DB_NAME = 'postupp-media';
const DB_VERSION = 1;
const STORE = 'recent';

/** How many items to keep. */
const MAX_ITEMS = 24;
/** Total budget for the store, in bytes. */
const MAX_BYTES = 40 * 1024 * 1024;
/** Items older than this are dropped on read. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface RecentMediaItem {
  /** Stable key derived from name/size/lastModified. */
  id: string;
  name: string;
  type: string;
  size: number;
  /** Epoch ms of the original file's lastModified, when known. */
  lastModified: number;
  /** Epoch ms this entry was added to the store. */
  addedAt: number;
  kind: 'image' | 'video';
  blob: Blob;
  /** Small data-URL preview, so the grid can render without reading the blob. */
  thumb?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('addedAt', 'addedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open media store'));
  });
  // A failed open should not poison every later call.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
};

const run = <T,>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> =>
  openDb()
    .then(
      (db) =>
        new Promise<T | null>((resolve) => {
          const tx = db.transaction(STORE, mode);
          const request = fn(tx.objectStore(STORE));
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => resolve(null);
          tx.onerror = () => resolve(null);
        }),
    )
    .catch(() => null);

export const recentMediaKey = (file: File): string =>
  `file:${file.name}:${file.size}:${file.lastModified}`;

/** Reads the store, newest first, pruning anything expired. */
export const listRecentMedia = async (): Promise<RecentMediaItem[]> => {
  const rows = await run<RecentMediaItem[]>('readonly', (store) => store.getAll() as IDBRequest<RecentMediaItem[]>);
  if (!rows || rows.length === 0) return [];
  const cutoff = Date.now() - MAX_AGE_MS;
  const live = rows.filter((row) => row.addedAt >= cutoff);
  const expired = rows.filter((row) => row.addedAt < cutoff);
  if (expired.length > 0) {
    // Best-effort prune; ignore failures.
    void run('readwrite', (store) => {
      expired.forEach((row) => store.delete(row.id));
      return store.count() as IDBRequest<number>;
    });
  }
  return live.sort((a, b) => b.addedAt - a.addedAt);
};

/**
 * Remembers files the user just picked. Call after a successful pick, not
 * before, so abandoned selections do not pollute the store.
 */
export const rememberRecentMedia = async (files: File[]): Promise<void> => {
  if (!files.length) return;
  const usable = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
  if (!usable.length) return;

  const now = Date.now();
  const entries: RecentMediaItem[] = usable.map((file) => ({
    id: recentMediaKey(file),
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    addedAt: now,
    kind: file.type.startsWith('video/') ? 'video' : 'image',
    blob: file,
  }));

  await run('readwrite', (store) => {
    entries.forEach((entry) => store.put(entry));
    return store.count() as IDBRequest<number>;
  });

  await pruneToBudget();
};

/**
 * Enforces the count and byte budgets, dropping oldest first. Skipped while
 * the store is small, which is the common case.
 */
const pruneToBudget = async (): Promise<void> => {
  const rows = await listRecentMedia();
  if (rows.length <= MAX_ITEMS) {
    const total = rows.reduce((sum, row) => sum + row.size, 0);
    if (total <= MAX_BYTES) return;
  }
  // Oldest first, so the tail is what gets dropped.
  const oldestFirst = [...rows].sort((a, b) => a.addedAt - b.addedAt);
  const keep: RecentMediaItem[] = [];
  let bytes = 0;
  for (const row of [...oldestFirst].reverse()) {
    if (keep.length >= MAX_ITEMS) break;
    if (bytes + row.size > MAX_BYTES) break;
    keep.push(row);
    bytes += row.size;
  }
  const keepIds = new Set(keep.map((row) => row.id));
  const drop = rows.filter((row) => !keepIds.has(row.id));
  if (drop.length === 0) return;
  await run('readwrite', (store) => {
    drop.forEach((row) => store.delete(row.id));
    return store.count() as IDBRequest<number>;
  });
};

/** Converts a stored entry back into a File for uploading. */
export const recentItemToFile = (item: RecentMediaItem): File =>
  new File([item.blob], item.name, { type: item.type, lastModified: item.lastModified });

export const clearRecentMedia = async (): Promise<void> => {
  await run('readwrite', (store) => store.clear() as IDBRequest<undefined>);
};
