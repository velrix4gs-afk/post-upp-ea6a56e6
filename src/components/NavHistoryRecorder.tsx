import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pushNavEntry } from '@/lib/navHistory';

/**
 * Records every route change (with its overlay state) into the breadcrumb
 * stack. Mounted once inside the router.
 */
export const NavHistoryRecorder = () => {
  const location = useLocation();

  useEffect(() => {
    pushNavEntry({
      path: `${location.pathname}${location.search}`,
      state: location.state ?? undefined,
    });
  }, [location.pathname, location.search, location.state]);

  return null;
};