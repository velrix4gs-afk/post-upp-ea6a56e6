import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    // Subscribe to real-time updates for new messages
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        },
        () => {
          fetchUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads'
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user) return;

    try {
      // Get all chats the user is part of
      const { data: userChats } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id);

      if (!userChats || userChats.length === 0) {
        setUnreadCount(0);
        return;
      }

      const chatIds = userChats.map(c => c.chat_id);

      // Get all messages in these chats that are not from the current user
      const { data: messages } = await supabase
        .from('messages')
        .select('id, sender_id')
        .in('chat_id', chatIds)
        .neq('sender_id', user.id);

      if (!messages || messages.length === 0) {
        setUnreadCount(0);
        return;
      }

      const messageIds = messages.map(m => m.id);

      // Get messages that have been read by the current user
      const { data: readMessages } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', messageIds);

      const readMessageIds = new Set(readMessages?.map(r => r.message_id) || []);
      
      // Count unread messages
      const unread = messages.filter(m => !readMessageIds.has(m.id)).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching unread message count:', error);
      setUnreadCount(0);
    }
  };

  return { unreadCount, refetch: fetchUnreadCount };
};
