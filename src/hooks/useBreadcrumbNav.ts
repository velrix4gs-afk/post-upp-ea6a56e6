import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { popNavEntry, peekPreviousEntry, pushNavEntry } from '@/lib/navHistory';

/**
 * Back navigation that always lands on the previous screen the user was on,
 * restoring any overlay (profile popup, etc.) that was open there.
 */
export const useBreadcrumbNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = useCallback(() => {
    const previous = popNavEntry();
    if (previous) {
      navigate(previous.path, { state: previous.state as any, replace: true });
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/feed', { replace: true });
  }, [navigate]);

  /** Navigate forward while remembering the overlay open on the current page. */
  const goTo = useCallback(
    (path: string, state?: unknown, overlayProfileId?: string) => {
      if (overlayProfileId) {
        pushNavEntry({
          path: `${location.pathname}${location.search}`,
          state: { ...(location.state as any), overlayProfileId },
        });
      }
      navigate(path, { state: state as any });
    },
    [navigate, location],
  );

  return { goBack, goTo, previousEntry: peekPreviousEntry() };
};