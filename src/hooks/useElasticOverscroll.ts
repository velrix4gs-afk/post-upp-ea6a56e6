import { useEffect } from 'react';

/**
 * Squishy scroll boundary: pulling past the top or bottom of the page gently
 * stretches the content vertically, then snaps back elastically on release.
 */
export const useElasticOverscroll = (
  targetRef: React.RefObject<HTMLElement>,
  enabled = true,
) => {
  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) return;

    let startY: number | null = null;

    const atTop = () => window.scrollY <= 0;
    const atBottom = () =>
      window.innerHeight + window.scrollY >= document.body.scrollHeight - 1;

    const reset = () => {
      el.style.transform = '';
      el.style.letterSpacing = '';
    };

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      const pullingDownAtTop = dy > 0 && atTop();
      const pullingUpAtBottom = dy < 0 && atBottom();
      if (!pullingDownAtTop && !pullingUpAtBottom) {
        reset();
        return;
      }
      const stretch = Math.min(0.045, Math.abs(dy) / 2400);
      el.style.transformOrigin = pullingDownAtTop ? 'center top' : 'center bottom';
      el.style.transform = `scaleY(${1 + stretch})`;
      el.style.letterSpacing = `${(stretch * 6).toFixed(3)}px`;
    };

    const onTouchEnd = () => {
      startY = null;
      reset();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [targetRef, enabled]);
};
