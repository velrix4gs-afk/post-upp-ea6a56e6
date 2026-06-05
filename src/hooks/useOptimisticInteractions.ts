// Optimistic likes/comments hook backed by IndexedDB + syncEngine.

import { useCallback } from 'react';
import {
  LocalInteraction,
  generateLocalId,
  putInteraction,
} from '@/lib/localCache';
import { flush } from '@/lib/syncEngine';

export function useOptimisticInteractions(userId?: string) {
  const like = useCallback(
    async (postId: string, reactionType: string = 'like') => {
      const row: LocalInteraction = {
        id: generateLocalId('like'),
        postId,
        type: 'like',
        content: reactionType,
        timestamp: Date.now(),
        syncStatus: 'pending',
        userId,
      };
      await putInteraction(row);
      void flush();
    },
    [userId],
  );

  const comment = useCallback(
    async (postId: string, content: string) => {
      if (!content.trim()) return;
      const row: LocalInteraction = {
        id: generateLocalId('comment'),
        postId,
        type: 'comment',
        content,
        timestamp: Date.now(),
        syncStatus: 'pending',
        userId,
      };
      await putInteraction(row);
      void flush();
    },
    [userId],
  );

  return { like, comment };
}
