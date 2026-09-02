import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  chatId: string;
}

interface TypingEvent {
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

const FADE_MS = 260;

const TypingIndicator = ({ chatId }: TypingIndicatorProps) => {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  // Keeps the bubble mounted through the fade-out so it never snap-vanishes.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!chatId || !user) return;

    const channel = supabase
      .channel(`typing:${chatId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const event = payload.payload as TypingEvent;

        if (event.user_id !== user.id) {
          if (event.is_typing) {
            setTypingUsers((prev) => [...new Set([...prev, event.display_name])]);
          } else {
            setTypingUsers((prev) => prev.filter((name) => name !== event.display_name));
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user]);

  // Reset when switching conversations so a stale bubble never carries over.
  useEffect(() => {
    setTypingUsers([]);
  }, [chatId]);

  useEffect(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);

    if (typingUsers.length > 0) {
      setMounted(true);
      // Next frame so the enter transition actually runs.
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }

    setVisible(false);
    fadeTimer.current = setTimeout(() => setMounted(false), FADE_MS);
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [typingUsers]);

  useEffect(() => () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  if (!mounted) return null;

  const label =
    typingUsers.length === 0
      ? ''
      : typingUsers.length === 1
      ? `${typingUsers[0]} is typing`
      : `${typingUsers.slice(0, 2).join(', ')}${typingUsers.length > 2 ? ' and others' : ''} are typing`;

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
