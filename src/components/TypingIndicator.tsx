import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { acquireTypingChannel } from '@/lib/typingChannel';

interface TypingIndicatorProps {
  chatId: string;
}

const FADE_MS = 260;
const STALE_TYPING_MS = 4500;

const TypingIndicator = ({ chatId }: TypingIndicatorProps) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<Array<{ id: string; name: string }>>([]);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!chatId || !user) return;

    const timers = typingTimers.current;
    const handle = acquireTypingChannel(chatId);

    const offEvent = handle.onEvent((event) => {
      if (event.user_id !== user.id) {
        if (event.is_typing) {
          const previousTimer = timers.get(event.user_id);
          if (previousTimer) clearTimeout(previousTimer);
          timers.set(
            event.user_id,
            setTimeout(() => {
              timers.delete(event.user_id);
              setTypingUsers((prev) => prev.filter((u) => u.id !== event.user_id));
            }, STALE_TYPING_MS)
          );
          setTypingUsers((prev) => {
            if (prev.some((u) => u.id === event.user_id)) return prev;
            return [...prev, { id: event.user_id, name: event.display_name || 'Someone' }];
          });
        } else {
          const previousTimer = timers.get(event.user_id);
          if (previousTimer) clearTimeout(previousTimer);
          timers.delete(event.user_id);
          setTypingUsers((prev) => prev.filter((u) => u.id !== event.user_id));
        }
      }
    });

    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
      offEvent();
      handle.release();
    };
  }, [chatId, user]);

  useEffect(() => {
    typingTimers.current.forEach(clearTimeout);
    typingTimers.current.clear();
    setTypingUsers([]);
  }, [chatId]);

  useEffect(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);

    if (typingUsers.length > 0) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    setVisible(false);
    fadeTimer.current = setTimeout(() => setMounted(false), FADE_MS);
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [typingUsers]);

  if (!mounted) return null;

  const label =
    typingUsers.length === 0
      ? ''
      : typingUsers.length === 1
        ? `${typingUsers[0].name} is typing`
        : `${typingUsers.slice(0, 2).map((u) => u.name).join(', ')}${typingUsers.length > 2 ? ' and others' : ''} are typing`;

  return (
    <div
      aria-live="polite"
      className={cn(
        'flex items-end gap-2 px-4 pb-1 pt-0.5',
        'transition-all duration-300 ease-out will-change-transform',
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1.5 scale-95'
      )}
    >
      <div className="relative">
        <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-[8px] bg-[#ffffff] dark:bg-[#202c33] border border-border/50 px-3.5 py-2.5 shadow-sm">
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/70" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/70" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/70" />
        </div>
      </div>
      {label && (
        <span className="text-[11px] text-muted-foreground mb-1 truncate max-w-[55%]">{label}</span>
      )}
    </div>
  );
};

export default TypingIndicator;
