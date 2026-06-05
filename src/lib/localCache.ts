// Offline-first local cache backed by IndexedDB.
// Separate DB from the existing `postup_cache` so we do not collide with
// the read-cache used by feed/profile/reels.
//
// SECURITY: This module never talks to Redis directly. All sync goes
// through `apiGateway.ts` -> Supabase Edge Functions. No external creds.

const DB_NAME = 'postupp_local_cache';
const DB_VERSION = 1;

export const STORE_MESSAGES = 'messages';
export const STORE_INTERACTIONS = 'interactions';

export type SyncStatus = 'synced' | 'pending';

export interface LocalMessage {
  id: string;
  conversationId: string;
  text: string;
  timestamp: number;
  syncStatus: SyncStatus;
  senderId?: string;
  mediaUrl?: string;
  mediaType?: string;
  replyTo?: string;
  remoteId?: string;
}

export interface LocalInteraction {
  id: string;
  postId: string;
  type: 'like' | 'comment';
  content: string;
  timestamp: number;
  syncStatus: SyncStatus;
  userId?: string;
  remoteId?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const s = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        s.createIndex('conversationId', 'conversationId', { unique: false });
        s.createIndex('syncStatus', 'syncStatus', { unique: false });
        s.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_INTERACTIONS)) {
        const s = db.createObjectStore(STORE_INTERACTIONS, { keyPath: 'id' });
        s.createIndex('postId', 'postId', { unique: false });
        s.createIndex('syncStatus', 'syncStatus', { unique: false });
        s.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
  return dbPromise;
}

function getAllByIndex<T>(store: string, indexName: string, key: IDBValidKey): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const t = db.transaction(store, 'readonly');
        const req = t.objectStore(store).index(indexName).getAll(key);
        req.onsuccess = () => resolve((req.result as T[]) || []);
        req.onerror = () => reject(req.error);
      }),
  );
}

function putRecord(store: string, record: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        t.objectStore(store).put(record);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      }),
  );
}

// ---------- Messages ----------

export async function putMessage(msg: LocalMessage): Promise<void> {
  await putRecord(STORE_MESSAGES, msg);
}

export async function listMessages(conversationId: string): Promise<LocalMessage[]> {
  const rows = await getAllByIndex<LocalMessage>(STORE_MESSAGES, 'conversationId', conversationId);
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

export function listPendingMessages(): Promise<LocalMessage[]> {
  return getAllByIndex<LocalMessage>(STORE_MESSAGES, 'syncStatus', 'pending');
}

// ---------- Interactions ----------

export async function putInteraction(it: LocalInteraction): Promise<void> {
  await putRecord(STORE_INTERACTIONS, it);
}

export function listInteractions(postId: string): Promise<LocalInteraction[]> {
  return getAllByIndex<LocalInteraction>(STORE_INTERACTIONS, 'postId', postId);
}

export function listPendingInteractions(): Promise<LocalInteraction[]> {
  return getAllByIndex<LocalInteraction>(STORE_INTERACTIONS, 'syncStatus', 'pending');
}

// ---------- Shared ----------

export async function markSynced(
  store: typeof STORE_MESSAGES | typeof STORE_INTERACTIONS,
  id: string,
  remoteId?: string,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    const getReq = s.get(id);
    getReq.onsuccess = () => {
      const row = getReq.result;
      if (!row) return;
      row.syncStatus = 'synced';
      if (remoteId) row.remoteId = remoteId;
      s.put(row);
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function removeRecord(
  store: typeof STORE_MESSAGES | typeof STORE_INTERACTIONS,
  id: string,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    t.objectStore(store).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function generateLocalId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${Date.now()}_${rand}`;
}
