import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves once Supabase has restored (or confirmed absence of) the auth
 * session from storage. Use to gate queries so RLS-scoped requests aren't
 * fired with a null auth.uid() on first mount.
 */
export const useAuthReady = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().finally(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return ready;
};