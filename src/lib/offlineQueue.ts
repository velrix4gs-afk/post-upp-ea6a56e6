import { supabase } from '@/integrations/supabase/client';
import { debug } from './logger';

const QUEUE_KEY = 'postup_offline_queue';
const MAX_RETRIES = 3;

export interface QueuedAction {
  id: string;
  action: 'insert' | 'update' | 'delete' | 'upsert' | 'rpc';
  table: string;
  payload: any;
  filters?: Record<string, any>;
  createdAt: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
}

const getQueue = (): QueuedAction[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveQueue = (queue: QueuedAction[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const enqueueOfflineAction = (
  action: QueuedAction['action'],
  table: string,
  payload: any,
  filters?: Record<string, any>
): string => {
  const id = crypto.randomUUID();
  const entry: QueuedAction = {
    id,
    action,
    table,
    payload,
    filters,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };
  const queue = getQueue();
  queue.push(entry);
  saveQueue(queue);
  debug('[OfflineQueue] Enqueued:', action, table, id);
  return id;
};

export const dequeueOfflineAction = (id: string) => {
  const queue = getQueue().filter(item => item.id !== id);
  saveQueue(queue);
};

export const getOfflineQueue = (): QueuedAction[] => getQueue();

export const getQueueLength = (): number => getQueue().length;

const processAction = async (item: QueuedAction): Promise<boolean> => {
  try {
    if (item.action === 'rpc') {
      const { error } = await supabase.functions.invoke(item.table, {
        body: item.payload,
      });
      if (error) throw error;
      return true;
    }

    if (item.action === 'insert') {
      const { error } = await (supabase.from(item.table as any) as any).insert(item.payload);
      if (error) throw error;
      return true;
    }

    if (item.action === 'update') {
      let query = (supabase.from(item.table as any) as any).update(item.payload);
      if (item.filters) {
        for (const [key, value] of Object.entries(item.filters)) {
          query = query.eq(key, value);
        }
      }
      const { error } = await query;
      if (error) throw error;
      return true;
    }

    if (item.action === 'delete') {
      let query = (supabase.from(item.table as any) as any).delete();
      if (item.filters) {
        for (const [key, value] of Object.entries(item.filters)) {
          query = query.eq(key, value);
        }
      }
      const { error } = await query;
      if (error) throw error;
      return true;
    }

    if (item.action === 'upsert') {
      const { error } = await (supabase.from(item.table as any) as any).upsert(item.payload);
      if (error) throw error;
      return true;
    }

    return false;
  } catch (err) {
    console.error('[OfflineQueue] Failed to process:', item.id, err);
    return false;
  }
};

export const flushOfflineQueue = async (): Promise<{ processed: number; failed: number }> => {
  if (!navigator.onLine) return { processed: 0, failed: 0 };

  const queue = getQueue();
  if (queue.length === 0) return { processed: 0, failed: 0 };

  debug('[OfflineQueue] Flushing', queue.length, 'items');

  let processed = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  for (const item of queue) {
    if (item.status === 'failed' && item.retryCount >= MAX_RETRIES) {
      // Permanently failed — drop it
      failed++;
      continue;
    }

    const success = await processAction(item);
    if (success) {
      processed++;
      debug('[OfflineQueue] Processed:', item.id);
    } else {
      item.retryCount++;
      item.status = item.retryCount >= MAX_RETRIES ? 'failed' : 'pending';
      remaining.push(item);
      if (item.retryCount >= MAX_RETRIES) failed++;
    }
  }

  saveQueue(remaining);
  debug('[OfflineQueue] Flush complete:', { processed, failed, remaining: remaining.length });
  return { processed, failed };
};
