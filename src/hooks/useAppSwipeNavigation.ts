import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PRIMARY_ROUTES = ['/dashboard', '/feed', '/explore', '/search', '/messages', '/friends'];
const SWIPE_THRESHOLD = 90;

const isSwipeExcluded = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return true;
  if (target.closest(
    'input, textarea, select, button, a, video, [role="button"], [role="dialog"], [data-no-app-swipe], [data-chat-thread]',
  )) return true;

  let element: Element | null = target;
  while (element) {
    if (element instanceof HTMLElement) {
      const overflowX = getComputedStyle(element).overflowX;
      if ((overflowX === 'auto' || overflowX === 'scroll') && element.scrollWidth > element.clientWidth) return true;
    }
    element = element.parentElement;
  }
  return false;
};

export const useAppSwipeNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let start: { x: number; y: number; target: EventTarget | null } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        start = null;
        return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, target: event.target };
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!start || event.changedTouches.length !== 1 || isSwipeExcluded(start.target)) {
        start = null;
        return;
      }
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const startX = start.x;
      start = null;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.35) return;

      const isFeed = location.pathname === '/feed' || location.pathname === '/' || location.pathname === '/dashboard';
      if (isFeed && dx < 0) {
        window.dispatchEvent(new CustomEvent('app:open-menu'));
        return;
      }

      const currentIndex = location.pathname === '/'
        ? PRIMARY_ROUTES.indexOf('/feed')
        : PRIMARY_ROUTES.indexOf(location.pathname);
      if (currentIndex < 0 || isFeed) {
        if (dx > 0 && startX <= 28) navigate(-1);
        return;
      }
      const nextIndex = Math.min(PRIMARY_ROUTES.length - 1, Math.max(0, currentIndex + (dx < 0 ? 1 : -1)));
      if (nextIndex !== currentIndex) navigate(PRIMARY_ROUTES[nextIndex]);
    };
    const onTouchCancel = () => { start = null; };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [location.pathname, navigate]);
};

export const AppSwipeNavigation = () => {
  useAppSwipeNavigation();
  return null;
};
