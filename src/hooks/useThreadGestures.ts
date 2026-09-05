import { useEffect } from 'react';

/**
 * Chat thread physics:
 *  - Drag the thread slightly to the left to peek every message timestamp.
 *  - Fast scrolling gently skews the bubble stack, settling back when it stops.
 * Both effects are driven through CSS variables on the thread container.
 */
export const useThreadGestures = (
  containerRef: React.RefObject<HTMLElement>,
  enabled = true,
) => {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    let startX: number | null = null;
    let startY: number | null = null;
    let peeking = false;

    const setPeek = (px: number) => {
      el.style.setProperty('--peek-x', `${px}px`);
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      peeking = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startX === null || startY === null) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!peeking && (Math.abs(dy) > Math.abs(dx) || dx > -12)) return;
      peeking = true;
      setPeek(Math.max(-56, dx * 0.5));
    };

    const onTouchEnd = () => {
      startX = null;
      startY = null;
      if (peeking) setPeek(0);
      peeking = false;
    };

    let lastTop = el.scrollTop;
    let lastTime = performance.now();
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(16, now - lastTime);
      const velocity = (el.scrollTop - lastTop) / dt;
      lastTop = el.scrollTop;
      lastTime = now;
      const skew = Math.max(-1.6, Math.min(1.6, velocity * 0.6));
      el.style.setProperty('--bubble-skew', `${skew.toFixed(2)}deg`);
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => el.style.setProperty('--bubble-skew', '0deg'), 110);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (settleTimer) clearTimeout(settleTimer);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('scroll', onScroll);
    };
  }, [containerRef, enabled]);
};
