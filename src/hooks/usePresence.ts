import { useState, useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserPresence {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  online_at: string;
  viewing_chat?: string;
}

export const usePresence = (chatId?: string) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresence>>({});
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<UserPresence>();
        const users: Record<string, UserPresence> = {};

        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            // Only consider users online if they've been active in the last 5 minutes
            const onlineAt = new Date(presence.online_at).getTime();
            const now = Date.now();
            if (now - onlineAt < 5 * 60 * 1000) {
              users[presence.user_id] = presence;
            }
          });
        });

        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Get user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', user.id)
            .single();

          await presenceChannel.track({
            user_id: user.id,
            display_name: profile?.display_name || 'User',
            avatar_url: profile?.avatar_url,
            online_at: new Date().toISOString(),
            viewing_chat: chatId,
          });

          // Update presence every 2 minutes to stay online
          const intervalId = setInterval(async () => {
            await presenceChannel.track({
              user_id: user.id,
              display_name: profile?.display_name || 'User',
              avatar_url: profile?.avatar_url,
              online_at: new Date().toISOString(),
              viewing_chat: chatId,
            });
          }, 2 * 60 * 1000);

          return () => clearInterval(intervalId);
        }
      });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
    };
    // Deliberately NOT depending on chatId here -- this channel represents
    // app-wide "who's online", not a per-chat thing. Recreating it every
    // time the user opens a different conversation was wiping everyone's
    // online status and rebuilding it from scratch, which is why the
    // indicator flickered offline/online while navigating between chats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateViewingChat = async (newChatId?: string) => {
    if (!channel || !user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();

    await channel.track({
      user_id: user.id,
      display_name: profile?.display_name || 'User',
      avatar_url: profile?.avatar_url,
      online_at: new Date().toISOString(),
      viewing_chat: newChatId,
    });
  };

  // Keep "viewing_chat" in sync with the currently open chat without
  // tearing down and re-subscribing the whole presence channel.
  useEffect(() => {
    if (!channel) return;
    updateViewingChat(chatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, chatId]);

  const isUserOnline = (userId: string) => {
    return !!onlineUsers[userId];
  };

  const isUserViewingChat = (userId: string, checkChatId: string) => {
    return onlineUsers[userId]?.viewing_chat === checkChatId;
  };

  return {
    onlineUsers,
    isUserOnline,
    isUserViewingChat,
    updateViewingChat,
  };
};