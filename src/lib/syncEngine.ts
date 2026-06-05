// Background sync engine. Listens for `online` and drains pending
// IndexedDB records to the API gateway. Optimistic UI stays untouched.
//
// SECURITY: No external creds, no direct Redis. Everything routes through
// the existing Supabase edge functions via `apiGateway`.

import {
  STORE_INTERACTIONS,
  STORE_MESSAGES,
  listPendingInteractions,
  listPendingMessages,
  markSynced,
  removeRecord,
} from './localCache';
import { invokeFunction } from './apiGateway';

const BATCH_SIZE = 25;
const MIN_FLUSH_GAP_MS = 1500;

let initialized = false;
let inflight = false;
let lastFlushAt = 0;
let backoffMs = 0;

async function flushMessages(): Promise<void> {
  const pending = await listPendingMessages();
  if (pending.length === 0) return;
  const batch = pending.slice(0, BATCH_SIZE);
  for (const m of batch) {
    const res = await invokeFunction<{ id?: string }>('messages-v2', {
      action: 'send',
      chat_id: m.conversationId,
      content: m.text,
      media_url: m.mediaUrl,
      media_type: m.mediaType,
      reply_to: m.replyTo,
    });
    if (res.ok) {
      await markSynced(STORE_MESSAGES, m.id, res.data?.id);
    } else {
      // leave pending; outer flush() will back off
      throw new Error(res.error ?? 'message sync failed');
    }
  }
}

async function flushInteractions(): Promise<void> {
  const pending = await listPendingInteractions();
  if (pending.length === 0) return;
  const batch = pending.slice(0, BATCH_SIZE);
  for (const it of batch) {
    if (it.type === 'like') {
      const res = await invokeFunction('reactions', {
        action: 'toggle',
        post_id: it.postId,
        reaction_type: it.content || 'like',
      });
      if (res.ok) await markSynced(STORE_INTERACTIONS, it.id);
      else throw new Error(res.error ?? 'like sync failed');
    } else {
      const res = await invokeFunction('posts', {
        action: 'comment',
        post_id: it.postId,
        content: it.content,
      });
      if (res.ok) await markSynced(STORE_INTERACTIONS, it.id);
      else throw new Error(res.error ?? 'comment sync failed');
    }
  }
  // Optionally clear long-synced rows to keep cache lean.
  const stillPending = await listPendingInteractions();
  if (stillPending.length === 0) {
    for (const it of batch) await removeRecord(STORE_INTERACTIONS, it.id).catch(() => {});
  }
}

export async function flush(): Promise<void> {
  if (inflight) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const now = Date.now();
  if (now - lastFlushAt < MIN_FLUSH_GAP_MS + backoffMs) return;
  inflight = true;
  lastFlushAt = now;
  try {
    await flushMessages();
    await flushInteractions();
    backoffMs = 0;
  } catch (err) {
    // exponential backoff up to 60s
    backoffMs = Math.min(60_000, backoffMs ? backoffMs * 2 : 4_000);
    console.warn('[syncEngine] flush failed, backing off', backoffMs, err);
  } finally {
    inflight = false;
  }
}

export function initSyncEngine(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('online', () => {
    void flush();
  });
  // First-paint flush if already online.
  if (navigator.onLine) {
    setTimeout(() => void flush(), 1500);
  }
}
