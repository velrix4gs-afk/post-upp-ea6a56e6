// Centralized "should I bother the user with a toast?" gate.
// When the device is offline (or the error is a transport-level network
// failure) the global offline indicator already speaks for itself —
// every other hook calling toast.error("Unable to load …") is just noise.

const NETWORK_PATTERNS = [
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
  'fetch',
  'network',
  'connection',
  'timeout',
  'abort',
  'functionsfetcherror',
  'tlsstreamerror',
];

export const isNetworkError = (error: unknown): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!error) return false;

  const msg =
    typeof error === 'string'
      ? error
      : (error as any)?.message ?? (error as any)?.error_description ?? '';
  const name = (error as any)?.name ?? '';
  const code = (error as any)?.code ?? '';
  const ctxMsg = (error as any)?.context?.message ?? '';

  const haystack = `${name} ${code} ${msg} ${ctxMsg}`.toLowerCase();
  if (NETWORK_PATTERNS.some((p) => haystack.includes(p))) return true;
  if (code === 'PGRST301' || code === 'ECONNREFUSED') return true;
  return false;
};

/**
 * Returns false when a destructive/error toast should be silently swallowed —
 * either because the user is offline or because the underlying error is a
 * transport problem that the global "No internet" indicator already covers.
 */
export const shouldShowErrorToast = (error?: unknown): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (error !== undefined && isNetworkError(error)) return false;
  return true;
};

/**
 * Log to the console (and any future telemetry) without ever toasting.
 * Use for background fetches whose failure does not need user attention.
 */
export const reportSilently = (code: string, error: unknown): void => {
  // eslint-disable-next-line no-console
  console.warn(`[${code}] silenced:`, error);
};
