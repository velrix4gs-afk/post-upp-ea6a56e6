// Optimistic messaging hook layered on top of IndexedDB + syncEngine.
// Writes locally first, renders instantly, and pushes via the API gateway.
// Does NOT replace useMessages — it complements it for components that opt in.

import { useCallback, useEffect, useState } from 'react';
import {
  LocalMessage,
  generateLocalId,
  listMessages,
  putMessage,
} from '@/lib/localCache';
import { flush } from '@/lib/syncEngine';

export function useOptimisticMessages(conversationId: string | undefined, senderId?: string) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    listMessages(conversationId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const send = useCallback(
    async (text: string, extras?: Partial<Pick<LocalMessage, 'mediaUrl' | 'mediaType' | 'replyTo'>>) => {
      if (!conversationId || (!text && !extras?.mediaUrl)) return;
      const msg: LocalMessage = {
        id: generateLocalId('msg'),
        conversationId,
        text,
        timestamp: Date.now(),
        syncStatus: 'pending',
        senderId,
        ...extras,
      };
      // Optimistic UI: render immediately.
      setMessages((prev) => [...prev, msg]);
      await putMessage(msg);
      // Fire-and-forget background sync.
      void flush();
    },
    [conversationId, senderId],
  );

  return { messages, send };
}
