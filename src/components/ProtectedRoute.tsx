import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/signin');
    }
  }, [user, loading, navigate]);

  // Gate on profiles.is_profile_complete — redirect new users to /onboarding.
  useEffect(() => {
    let cancelled = false;
    if (loading || !user) return;
    if (location.pathname === '/onboarding') { setCheckedOnboarding(true); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_profile_complete')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data && data.is_profile_complete === false) {
        navigate('/onboarding', { replace: true });
      }
      setCheckedOnboarding(true);
    })();
    return () => { cancelled = true; };
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-60 w-full" />
            </div>
            <div className="lg:col-span-6 space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
            <div className="lg:col-span-3 space-y-6">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return <>{children}</>;
};

export default ProtectedRoute;