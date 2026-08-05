import { toast as sonnerToast } from 'sonner';

/**
 * Sleek, non-blocking connection toast.
 * Single fixed id so it can never stack, bottom-floating, with a one-tap Retry.
 */
const CONNECTION_TOAST_ID = 'connection-status';

let lastRetry: (() => void | Promise<void>) | null = null;

/** Register the action a "Retry" tap should re-run (last one wins). */
export const setConnectionRetryAction = (fn: (() => void | Promise<void>) | null) => {
  lastRetry = fn;
};

const defaultRetry = () => {
  if (typeof window !== 'undefined') window.location.reload();
};

export const showConnectionLost = (opts?: {
  message?: string;
  onRetry?: () => void | Promise<void>;
}) => {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  const retry = opts?.onRetry ?? lastRetry ?? defaultRetry;

  sonnerToast.dismiss(CONNECTION_TOAST_ID);
  sonnerToast(opts?.message ?? 'Connection lost', {
    id: CONNECTION_TOAST_ID,
    position: 'bottom-center',
    duration: 6000,
    className: 'rounded-full shadow-lg',
    action: {
      label: 'Retry',
      onClick: () => {
        try {
          void retry();
        } catch {
          /* non-fatal */
        }
      },
    },
  });
};

export const showConnectionRestored = (pending = 0) => {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  sonnerToast.dismiss(CONNECTION_TOAST_ID);
  sonnerToast.success(pending > 0 ? `Back online — syncing ${pending}` : 'Back online', {
    id: CONNECTION_TOAST_ID,
    position: 'bottom-center',
    duration: 1500,
    className: 'rounded-full shadow-lg',
  });
};
