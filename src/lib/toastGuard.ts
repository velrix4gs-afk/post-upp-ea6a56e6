import { toast as sonnerToast } from 'sonner';
import { shouldShowErrorToast } from './errorSuppression';

const WINDOW_MS = 10000;
const recent = new Map<string, number>();

/**
 * Returns true when this toast is allowed through.
 * Blocks duplicates of the same message inside a 10s window and any
 * error toast that is really just a transport/offline failure.
 */
export const allowToast = (key: string, isError: boolean): boolean => {
  if (isError && !shouldShowErrorToast(key)) return false;

  const now = Date.now();
  // Opportunistic cleanup
  if (recent.size > 50) {
    recent.forEach((ts, k) => {
      if (now - ts > WINDOW_MS) recent.delete(k);
    });
  }
  const last = recent.get(key);
  if (last && now - last < WINDOW_MS) return false;
  recent.set(key, now);
  return true;
};

let installed = false;

/**
 * Wraps sonner's error/warning channels with the same dedupe + offline
 * suppression the shadcn toaster uses, so a burst of failing requests
 * produces one message instead of a wall of them.
 */
export const installToastGuard = () => {
  if (installed) return;
  installed = true;

  const guard = (channel: 'error' | 'warning') => {
    const original = (sonnerToast as any)[channel]?.bind(sonnerToast);
    if (!original) return;
    (sonnerToast as any)[channel] = (message: any, data?: any) => {
      const key = `${channel}:${typeof message === 'string' ? message : ''}:${data?.description ?? ''}`;
      if (!allowToast(key, channel === 'error')) return '' as any;
      return original(message, data);
    };
  };

  guard('error');
  guard('warning');
};
