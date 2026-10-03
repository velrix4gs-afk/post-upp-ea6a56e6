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
  postId: string;
  enabled?: boolean;
}

export const useDwellTracker = (options: UseDwellTrackerOptions) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const visibleSinceRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const engagedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateElapsed = useCallback(() => {
    const visibleSince = visibleSinceRef.current;
    const card = targetRef.current;
    if (!card || visibleSince == null) return;
    const elapsed = Math.floor((accumulatedMsRef.current + Date.now() - visibleSince) / 1000);
    card.dataset.dwellSeconds = String(elapsed);
  }, []);

  const emitDwell = useCallback(() => {
    const since = visibleSinceRef.current;
    if (since == null) return;
    visibleSinceRef.current = null;
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const duration = Date.now() - since;
    accumulatedMsRef.current += duration;
    updateElapsed();
    const { enabled = true, postId: _postId, ...target } = optionsRef.current;
    if (!enabled) return;
    recordDwellSignal(duration, engagedRef.current, target);
  }, [updateElapsed]);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || options.enabled === false) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (visibleSinceRef.current == null) {
            visibleSinceRef.current = Date.now();
            markPostViewed(optionsRef.current.postId);
            updateElapsed();
            timerRef.current = window.setInterval(updateElapsed, 1000);
          }
        } else {
          emitDwell();
        }
      },
      // A smaller ratio still tracks cards taller than the viewport.
      { threshold: 0.25 }
    );

    observer.observe(target);
    return () => {
      emitDwell();
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      observer.disconnect();
    };
  }, [emitDwell, options.enabled, options.postId, updateElapsed]);

  // Mark that the user took a downstream action on this post — upgrades the
  // confidence of the pending dwell signal.
  const markEngaged = useCallback(() => {
    engagedRef.current = true;
  }, []);

  const buildTarget = useCallback((): SignalTarget => {
    const { enabled: _enabled, postId: _postId, ...target } = optionsRef.current;
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
