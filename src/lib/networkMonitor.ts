import { toast as sonnerToast } from 'sonner';
import { flushOfflineQueue, getQueueLength } from '@/lib/offlineQueue';
import { shouldShowErrorToast } from '@/lib/errorSuppression';

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let initialized = false;

// Single sonner id so the offline / back-online indicator can never stack.
const NET_TOAST_ID = 'net-status';

const showOffline = () => {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  sonnerToast.dismiss(NET_TOAST_ID);
  sonnerToast('No internet', { id: NET_TOAST_ID, duration: 1000 });
};

const showBackOnline = (pending: number) => {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  sonnerToast.dismiss(NET_TOAST_ID);
  sonnerToast.success(pending > 0 ? `Back online — syncing ${pending}` : 'Back online', {
    id: NET_TOAST_ID,
    duration: 1500,
  });
};

export const initNetworkMonitor = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Patch sonner so any `toast.error(...)` call gets globally suppressed
  // when the device is offline or the message is a transport-level failure.
  try {
    const originalError = (sonnerToast as any).error?.bind(sonnerToast);
    if (typeof originalError === 'function' && !(sonnerToast as any).__netGuarded) {
      (sonnerToast as any).error = (message: any, opts?: any) => {
        const haystack =
          typeof message === 'string'
            ? message
            : `${message?.title ?? ''} ${message?.description ?? ''}`;
        if (!shouldShowErrorToast(haystack)) {
          // eslint-disable-next-line no-console
          console.warn('[sonner.error] suppressed:', message);
          return 'suppressed' as any;
        }
        return originalError(message, opts);
      };
      (sonnerToast as any).__netGuarded = true;
    }
  } catch {
    /* non-fatal */
  }

  window.addEventListener('online', async () => {
    isOnline = true;
    const queueLen = getQueueLength();
    showBackOnline(queueLen);
    if (queueLen > 0) {
      try {
        await flushOfflineQueue();
      } catch {
        /* silent — next online tick will retry */
      }
    }
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    showOffline();
  });
};

export const isNetworkOnline = () => isOnline;

export const handleNetworkError = (error: unknown) => {
  // Never spam toasts here — the offline/online listeners own user feedback.
  // eslint-disable-next-line no-console
  console.warn('[NetworkMonitor] silenced error:', error);
  if (!isOnline) showOffline();
};