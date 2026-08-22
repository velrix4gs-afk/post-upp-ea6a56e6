/**
 * Lightweight haptic feedback wrapper.
 * Wraps navigator.vibrate so callers don't have to feature-detect every time.
 * Silently no-ops on unsupported devices (desktop, iOS Safari).
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'like' | 'publishPost';

const PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 18,
  heavy: 28,
  success: [10, 40, 10],
  warning: [20, 60, 20],
  error: [30, 50, 30, 50, 30],
  like: 10,
  publishPost: [50, 100, 50],
};

export const haptic = (type: HapticType = 'light'): void => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERNS[type] ?? 10);
    }
  } catch {
    // Vibration API throws in some embedded contexts — swallow it.
  }
};

export default haptic;