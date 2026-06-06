/**
 * Network Error Handler
 * Detects network errors and provides clean, user-friendly error messages
 */

export const isNetworkError = (error: any): boolean => {
  // Check if user is offline
  if (!navigator.onLine) {
    return true;
  }

  // Check for common network error patterns
  const errorString = error?.message?.toLowerCase() || '';
  const networkPatterns = [
    'fetch',
    'network',
    'connection',
    'timeout',
    'abort',
    'failed to fetch',
    'networkerror',
    'network request failed'
  ];

  if (networkPatterns.some(pattern => errorString.includes(pattern))) {
    return true;
  }

  // Check for Supabase network errors
  if (error?.code === 'PGRST301' || error?.code === 'ECONNREFUSED') {
    return true;
  }

  return false;
};

export const getCleanErrorMessage = (error: any): string => {
  if (isNetworkError(error)) {
    return 'No internet connection. Please check your network and try again.';
  }

  // Map common database errors to friendly messages
  const errorMessage = error?.message || '';
  
  if (errorMessage.includes('duplicate key')) {
    return 'This item already exists. Please try a different value.';
  }

  if (errorMessage.includes('foreign key')) {
    return 'Cannot complete this action due to related data.';
  }

  if (errorMessage.includes('permission') || errorMessage.includes('policy')) {
    return 'You do not have permission to perform this action.';
  }

  if (errorMessage.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Return a generic message for unknown errors
  return 'An unexpected error occurred. Please try again.';
};

export const handleNetworkError = (error: any, toastFn: any, title = 'Error') => {
  // Suppress when offline OR when the error itself is a transport-level failure —
  // the global offline indicator already speaks for those cases.
  if (!navigator.onLine || isNetworkError(error)) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[handleNetworkError] suppressed:', error);
    }
    return;
  }

  const cleanMessage = getCleanErrorMessage(error);
  toastFn({
    title,
    description: cleanMessage,
    variant: 'destructive',
  });

  if (process.env.NODE_ENV === 'development') {
    console.error('[Network Error]', error);
  }
};
