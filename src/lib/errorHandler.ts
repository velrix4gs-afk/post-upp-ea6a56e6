// Clean error message handler for user-friendly error display

interface ErrorCode {
  code: string;
  userMessage: string;
}

const ERROR_CODES: Record<string, ErrorCode> = {
  // Auth errors
  'auth/invalid-credentials': { code: 'AUTH001', userMessage: 'Invalid email or password' },
  'auth/user-not-found': { code: 'AUTH002', userMessage: 'Account not found' },
  'auth/email-in-use': { code: 'AUTH003', userMessage: 'Email already registered' },
  'auth/weak-password': { code: 'AUTH004', userMessage: 'Password too weak' },
  'auth/network-error': { code: 'AUTH005', userMessage: 'Connection failed' },
  
  // Database errors
  'PGRST': { code: 'DB001', userMessage: 'Database error occurred' },
  '23505': { code: 'DB002', userMessage: 'Item already exists' },
  '23503': { code: 'DB003', userMessage: 'Referenced item not found' },
  '42501': { code: 'DB004', userMessage: 'Permission denied' },
  
  // Storage errors
  'storage/unauthorized': { code: 'STOR001', userMessage: 'Upload not allowed' },
  'storage/object-not-found': { code: 'STOR002', userMessage: 'File not found' },
  'storage/quota-exceeded': { code: 'STOR003', userMessage: 'Storage limit reached' },
  
  // Network errors
  'network': { code: 'NET001', userMessage: 'Connection lost' },
  'timeout': { code: 'NET002', userMessage: 'Request timed out' },
  
  // Chat errors
  'no-id-returned': { code: 'CHAT001', userMessage: 'Failed to create chat' },
  'chat-not-found': { code: 'CHAT002', userMessage: 'Chat not found' },
  
  // Post errors
  'post-not-found': { code: 'POST001', userMessage: 'Post not found' },
  'post-deleted': { code: 'POST002', userMessage: 'Post was deleted' },
  
  // Upload errors
  'file-too-large': { code: 'UPLOAD001', userMessage: 'File too large (max 10MB)' },
  'invalid-file-type': { code: 'UPLOAD002', userMessage: 'Invalid file type' },
  'upload-failed': { code: 'UPLOAD003', userMessage: 'Upload failed' },
  
  // Tip errors
  'invalid-amount': { code: 'TIP001', userMessage: 'Invalid tip amount' },
  'tip-failed': { code: 'TIP002', userMessage: 'Failed to send tip' },
  
  // Premium errors
  'subscription-failed': { code: 'PREMIUM001', userMessage: 'Subscription failed' },
  'payment-required': { code: 'PREMIUM002', userMessage: 'Premium feature - upgrade required' },
  
  // Default
  'unknown': { code: 'ERR000', userMessage: 'Something went wrong' }
};

export const getCleanError = (error: any): { message: string; code: string } => {
  // Handle string errors
  if (typeof error === 'string') {
    // Check for known patterns
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      if (error.toLowerCase().includes(key.toLowerCase())) {
        return { message: value.userMessage, code: value.code };
      }
    }
    return { message: error, code: ERROR_CODES.unknown.code };
  }

  // Handle error objects
  const errorMessage = error?.message || error?.error_description || 'Unknown error';
  const errorCode = error?.code || error?.status || '';

  // Try to match error code
  if (errorCode && ERROR_CODES[errorCode]) {
    return { 
      message: ERROR_CODES[errorCode].userMessage, 
      code: ERROR_CODES[errorCode].code 
    };
  }

  // Try to match error message
  for (const [key, value] of Object.entries(ERROR_CODES)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return { message: value.userMessage, code: value.code };
    }
  }

  // Extract meaningful part of error message
  const cleanMessage = errorMessage
    .replace(/Error:/gi, '')
    .replace(/Failed to/gi, 'Cannot')
    .replace(/Please try again/gi, '')
    .trim();

  return { 
    message: cleanMessage.slice(0, 60) || 'Something went wrong',
    code: ERROR_CODES.unknown.code 
  };
};

import { shouldShowErrorToast } from '@/lib/errorSuppression';

export const showCleanError = (error: any, toast: any, customTitle?: string) => {
  // Silently drop network/offline errors — the global offline indicator covers them.
  if (!shouldShowErrorToast(error)) {
    // eslint-disable-next-line no-console
    console.warn('[showCleanError] suppressed (offline/network):', error);
    return;
  }
  const { message, code } = getCleanError(error);
  
  // Extract code from error if it contains one
  const errorCode = error?.message?.includes('[') ? 
    error.message.split('[')[1]?.split(']')[0] : code;
  
  let description = `${message} [${errorCode}]`;
  
  // Add technical details in development
  if (process.env.NODE_ENV === 'development' && error?.message) {
    const details = typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error);
    description += `\n\n📋 Technical Details:\n${details.slice(0, 200)}...`;
  }
  
  toast({
    title: `⚠️ ${customTitle || 'Error'}`,
    description: description,
    variant: 'destructive',
    duration: 8000,
    className: 'border-2 border-destructive shadow-lg max-w-md',
  });
};
