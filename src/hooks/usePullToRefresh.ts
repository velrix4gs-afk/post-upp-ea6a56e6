import { useEffect, useState, useRef, RefObject } from 'react';

interface UsePullToRefreshProps {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
}

export const usePullToRefresh = ({ 
  onRefresh, 
  threshold = 80,
  resistance = 2.5 
}: UsePullToRefreshProps) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  // Only allow a pull that BEGAN at the very top of the page. This prevents
  // rubber-band / mid-scroll gestures from triggering a refresh when the
  // user is scrolling near the bottom of the feed.
  const startedAtTop = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 30
      };
      navigator.vibrate(patterns[style]);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === 'undefined' || window.innerWidth > 1024) return;

    const handleTouchStart = (e: TouchEvent) => {
      startedAtTop.current = window.scrollY <= 0 && !isRefreshing;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing || window.scrollY > 0 || !startedAtTop.current) return;
      
      const currentY = e.touches[0].clientY;
      const distance = currentY - touchStartY.current;
      
      if (distance > 0) {
        setIsPulling(true);
        setPullDistance(Math.min(distance / resistance, threshold * 1.5));
      }
    };

    const handleTouchEnd = async () => {
      if (startedAtTop.current && pullDistance >= threshold && !isRefreshing) {
        triggerHaptic('medium');
        setIsRefreshing(true);
        await onRefresh();
        setIsRefreshing(false);
      }
      setIsPulling(false);
      setPullDistance(0);
      touchStartY.current = 0;
      startedAtTop.current = false;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, threshold, isRefreshing, onRefresh, resistance]);

  return {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance,
  };
};
