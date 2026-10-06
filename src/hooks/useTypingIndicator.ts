import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { acquireTypingChannel } from '@/lib/typingChannel';

type TypingHandle = ReturnType<typeof acquireTypingChannel>;

export const useTypingIndicator = (chatId: string | undefined) => {
  const { user } = useAuth();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleRef = useRef<TypingHandle | null>(null);
  const typingActiveRef = useRef(false);
  const displayNameRef = useRef('User');

  useEffect(() => {
    if (!chatId || !user) return;

    const handle = acquireTypingChannel(chatId);
    handleRef.current = handle;
    typingActiveRef.current = false;

    void supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Could not load typing indicator profile:', error);
          return;
        }
        if (data?.display_name) displayNameRef.current = data.display_name;
      });

    const offStatus = handle.onStatus((subscribed) => {
      if (subscribed && typingActiveRef.current) {
        void handle.send({ user_id: user.id, display_name: displayNameRef.current, is_typing: true });
      }
    });

    return () => {
      offStatus();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingActiveRef.current = false;
      void Promise.resolve(
        handle.send({ user_id: user.id, display_name: displayNameRef.current, is_typing: false }),
      ).finally(() => handle.release());
      if (handleRef.current === handle) handleRef.current = null;
    };
  }, [chatId, user]);

  const handleTyping = useCallback(() => {
    typingActiveRef.current = true;
    const handle = handleRef.current;
    if (handle && user) {
      void handle.send({ user_id: user.id, display_name: displayNameRef.current, is_typing: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      const current = handleRef.current;
      if (current && user) {
        void current.send({ user_id: user.id, display_name: displayNameRef.current, is_typing: false });
      }
    }, 2500);
  }, [user]);

  return { handleTyping };
};
