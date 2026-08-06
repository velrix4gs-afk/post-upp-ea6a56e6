import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface Chat {
  id: string;
  name?: string;
  avatar_url?: string;
  is_group: boolean;
  type: string;
  created_at: string;
  other_user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

export const useChats = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      
      // Get all chats the user is part of
      const { data: chatParticipants, error: participantsError } = await supabase
        .from('chat_participants')
        .select(`
          chat_id,
          chats:chat_id (
            id,
            name,
            avatar_url,
            type,
            created_at
          )
        `)
        .eq('user_id', user?.id);

      if (participantsError) throw participantsError;

      // Process chats and get other participants for private chats
      const processedChats = await Promise.all(
        (chatParticipants || []).map(async (cp: any) => {
          const chat = cp.chats;
          if (!chat) return null;

          if (chat.type === 'private') {
            // Get the other participant
            const { data: otherParticipant } = await supabase
              .from('chat_participants')
              .select(`
                user_id,
                profiles:user_id (
                  id,
                  username,
                  display_name,
                  avatar_url
                )
              `)
              .eq('chat_id', chat.id)
              .neq('user_id', user?.id)
              .single();

            return {
              ...chat,
              is_group: false,
              other_user: otherParticipant?.profiles,
              is_online: false,
              last_seen: null
            };
          }

          return {
            ...chat,
            is_group: chat.type === 'group'
          };
        })
      );

      setChats(processedChats.filter(Boolean) as Chat[]);
    } catch (err: any) {
      console.error('[CHAT] Failed to load chats:', err);
      // Silently fail - user doesn't need to see this error
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (participantUuid: string, skipMutualCheck: boolean = false) => {
    if (!user) {
      console.error('[CHAT] User not authenticated');
      return null;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(participantUuid)) {
      console.error('[CHAT] Invalid UUID format:', participantUuid);
      return null;
    }

    // Check mutual follow status before creating chat (unless skipped)
    if (!skipMutualCheck) {
      // Check if current user follows the target
      const { data: userFollowsTarget } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', participantUuid)
        .eq('status', 'accepted')
        .maybeSingle();

      // Check if target follows current user
      const { data: targetFollowsUser } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', participantUuid)
        .eq('following_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle();

      if (!userFollowsTarget || !targetFollowsUser) {
        toast({
          title: 'Cannot message',
          description: 'You can only message people who follow you back',
          variant: 'destructive'
        });
        return null;
      }
    }

    try {
      const chatId = await ensurePrivateChat(user.id, participantUuid);
      await fetchChats();
      return chatId;
    } catch (err: any) {
      console.error('[CHAT] Error:', err);
      toast({
        title: 'Could not start chat',
        description: err?.message || 'Please try again',
        variant: 'destructive',
      });
      return null;
    }
  };

  return {
    chats,
    loading,
    fetchChats,
    createChat
  };
};
