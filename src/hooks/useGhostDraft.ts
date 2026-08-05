import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'postup_ghost_draft:';
const DEBOUNCE_MS = 400;
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface StoredGhostDraft {
  text: string;
  savedAt: number;
}

/**
 * Ghost drafting: keeps composer text alive in localStorage so accidentally
 * closing a modal or navigating away never loses what the user typed.
 */
export const useGhostDraft = (key: string) => {
  const storageKey = `${PREFIX}${key}`;
  const [restoredText, setRestoredText] = useState<string | null>(null);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: StoredGhostDraft = JSON.parse(raw);
      if (!parsed?.text?.trim()) return;
      if (Date.now() - (parsed.savedAt ?? 0) > MAX_AGE_MS) {
        localStorage.removeItem(storageKey);
        return;
      }
      setRestoredText(parsed.text);
      setShowRestoredNotice(true);
    } catch {
      /* corrupted entry — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const saveDraft = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          if (!text.trim()) localStorage.removeItem(storageKey);
          else
            localStorage.setItem(
              storageKey,
              JSON.stringify({ text, savedAt: Date.now() } as StoredGhostDraft)
            );
        } catch {
          /* quota — ignore */
        }
      }, DEBOUNCE_MS);
    },
    [storageKey]
  );

  const clearDraft = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setRestoredText(null);
    setShowRestoredNotice(false);
  }, [storageKey]);

  const dismissNotice = useCallback(() => setShowRestoredNotice(false), []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { restoredText, showRestoredNotice, saveDraft, clearDraft, dismissNotice };
};
