import { useEffect, useRef, useCallback } from 'react';
import {
  recordDwellSignal,
  recordSignal,
  recordReactionSignal,
  markPostViewed,
  SIGNAL_WEIGHTS,
  type SignalTarget,
  type AffinityReactionType,
} from '@/lib/affinityProfile';

// Silent dwell-time interest tracking per docs/FEED_ALGORITHM.md §2.
// Mounts an IntersectionObserver on a post card, measures how long the card
// stays in the viewport, and emits a confidence-weighted signal when it
// leaves. Explicit actions (reaction, bookmark, comment, follow) upgrade the
// dwell confidence and record their own super-signals.

interface UseDwellTrackerOptions extends SignalTarget {
  enabled?: boolean;
}

export const useDwellTracker = (options: UseDwellTrackerOptions) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const visibleSinceRef = useRef<number | null>(null);
  const engagedRef = useRef(false);
  const emittedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const emitDwell = useCallback(() => {
    const since = visibleSinceRef.current;
    if (since == null || emittedRef.current) return;
    emittedRef.current = true;
    const duration = Date.now() - since;
    const { enabled = true, ...target } = optionsRef.current;
    if (!enabled) return;
    recordDwellSignal(duration, engagedRef.current, target);
  }, []);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || options.enabled === false) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (visibleSinceRef.current == null) {
            visibleSinceRef.current = Date.now();
            emittedRef.current = false;
            markPostViewed();
          }
        } else {
          emitDwell();
          visibleSinceRef.current = null;
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(target);
    return () => {
      emitDwell();
      observer.disconnect();
    };
  }, [emitDwell, options.enabled]);

  // Mark that the user took a downstream action on this post — upgrades the
  // confidence of the pending dwell signal.
  const markEngaged = useCallback(() => {
    engagedRef.current = true;
  }, []);

  const buildTarget = useCallback((): SignalTarget => {
    const { enabled: _enabled, ...target } = optionsRef.current;
    return target;
  }, []);

  const reportReaction = useCallback(
    (type: AffinityReactionType) => {
      engagedRef.current = true;
      recordReactionSignal(type, buildTarget());
    },
    [buildTarget]
  );

  const reportBookmark = useCallback(() => {
    engagedRef.current = true;
    recordSignal(SIGNAL_WEIGHTS.bookmark, buildTarget());
  }, [buildTarget]);

  const reportCommentExpand = useCallback(() => {
    engagedRef.current = true;
    recordSignal(SIGNAL_WEIGHTS.commentExpand, buildTarget());
  }, [buildTarget]);

  const reportFollow = useCallback(() => {
    engagedRef.current = true;
    recordSignal(SIGNAL_WEIGHTS.followAuthor, buildTarget());
  }, [buildTarget]);

  const reportShare = useCallback(() => {
    engagedRef.current = true;
    recordSignal(SIGNAL_WEIGHTS.shareDm, buildTarget());
  }, [buildTarget]);

  return {
    targetRef,
    markEngaged,
    reportReaction,
    reportBookmark,
    reportCommentExpand,
    reportFollow,
    reportShare,
  };
};
