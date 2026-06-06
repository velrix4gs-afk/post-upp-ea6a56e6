import { useEffect, useRef } from 'react';
import { flushOfflineQueue, getQueueLength } from '@/lib/offlineQueue';

export const useOfflineSync = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handleOnline = async () => {
      console.log('[OfflineSync] Back online — flushing queue');
      try { await flushOfflineQueue(); } catch { /* silent — networkMonitor surfaces UX */ }
    };

    // Flush on mount if online and queue has items
    if (navigator.onLine && getQueueLength() > 0) {
      flushOfflineQueue();
    }

    window.addEventListener('online', handleOnline);

    // Periodic retry every 30s while online
    intervalRef.current = setInterval(() => {
      if (navigator.onLine && getQueueLength() > 0) {
        flushOfflineQueue();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
};
