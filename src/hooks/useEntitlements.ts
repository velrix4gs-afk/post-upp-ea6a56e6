import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PLAN_ENTITLEMENTS, normalizePlan, type Entitlements } from '@/lib/entitlements';

const cacheKey = (userId: string) => `postup_plan_${userId}`;

const readCached = (userId?: string) => {
  if (!userId) return 'free';
  try { return normalizePlan(localStorage.getItem(cacheKey(userId))); } catch { return 'free'; }
};

/** The signed-in user's active plan and what it unlocks. Falls back to the cached plan while loading. */
export const useEntitlements = (): Entitlements & { loading: boolean } => {
  const { user } = useAuth();
  const [plan, setPlan] = useState(() => readCached(user?.id));
  const [loading, setLoading] = useState(!!user);

  useEffect(() => {
    if (!user) { setPlan('free'); setLoading(false); return; }
    let cancelled = false;
    setPlan(readCached(user.id));
    (async () => {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('plan_id, status, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const active = data
        && data.status === 'active'
        && (!data.current_period_end || new Date(data.current_period_end).getTime() > Date.now());
      const next = normalizePlan(active ? data!.plan_id : null);
      setPlan(next);
      setLoading(false);
      try { localStorage.setItem(cacheKey(user.id), next); } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { ...PLAN_ENTITLEMENTS[plan], loading };
};
