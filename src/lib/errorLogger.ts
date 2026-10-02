import { supabase } from '@/integrations/supabase/client';

interface ErrorLogData {
  code?: string;
  message: string;
  type: string;
  context?: any;
  componentName?: string;
  userId?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Logs errors to backend database for debugging without showing technical details to users
 */
export const logError = async (error: ErrorLogData) => {
  try {
    const pageUrl = window.location.href;
    const userAgent = navigator.userAgent;
    
    await supabase.from('error_logs').insert({
      error_code: error.code,
      error_message: error.message,
      error_type: error.type,
      context: error.context ? JSON.stringify(error.context) : null,
      component_name: error.componentName,
      page_url: pageUrl,
      user_agent: userAgent,
      severity: error.severity || 'error',
      user_id: error.userId
    });
    
    // Only log to console in development
    if (import.meta.env.DEV) {
      console.error('[ErrorLogger]', {
        code: error.code,
        message: error.message,
        context: error.context
      });
    }
  } catch (logError) {
    // Silently fail - don't block user experience if logging fails
    console.error('Failed to log error:', logError);
  }
};

/**
 * User-friendly error messages mapped from technical errors
 */
export const getFriendlyErrorMessage = (errorCode?: string): string => {
  const errorMessages: Record<string, string> = {
    'CHAT_001': 'Unable to load messages',
    'CHAT_002': 'Unable to start chat',
    'CHAT_003': 'Unable to send message',
    'CHAT_004': 'Unable to delete message',
    'CHAT_005': 'Chat error occurred',
    'AUTH_001': 'Please sign in to continue',
    'AUTH_002': 'Session expired',
    'NETWORK_001': 'Connection lost',
    'UPLOAD_001': 'Upload failed',
    'VALIDATION_001': 'Invalid input',
  };
  
  return errorMessages[errorCode || ''] || 'Something went wrong';
};
