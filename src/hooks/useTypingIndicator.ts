import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useTypingIndicator = (chatId: string | undefined) => {
  const { user } = useAuth();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const typingActiveRef = useRef(false);
  const displayNameRef = useRef('User');

  useEffect(() => {
    if (!chatId || !user) return;

    const channel = supabase.channel(`typing:${chatId}`, {
      config: { broadcast: { self: false, ack: true } },
    });
    channelRef.current = channel;
    subscribedRef.current = false;
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

    channel.subscribe((status) => {
      subscribedRef.current = status === 'SUBSCRIBED';
      if (subscribedRef.current && typingActiveRef.current) {
        void channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            user_id: user.id,
            display_name: displayNameRef.current,
            is_typing: true,
          },
        });
      }
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingActiveRef.current = false;
      if (subscribedRef.current) {
        void channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { user_id: user.id, display_name: displayNameRef.current, is_typing: false },
        }).finally(() => void supabase.removeChannel(channel));
      } else {
        void supabase.removeChannel(channel);
      }
      if (channelRef.current === channel) channelRef.current = null;
      subscribedRef.current = false;
    };
  }, [chatId, user]);

  const handleTyping = useCallback(() => {
    typingActiveRef.current = true;
    if (subscribedRef.current && channelRef.current && user) {
      void channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: user.id,
          display_name: displayNameRef.current,
          is_typing: true,
        },
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      if (subscribedRef.current && channelRef.current && user) {
        void channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            user_id: user.id,
            display_name: displayNameRef.current,
            is_typing: false,
          },
        });
      }
    }, 2500);
  }, [user]);

  return { handleTyping };
};
