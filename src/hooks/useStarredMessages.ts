import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export const useStarredMessages = (chatId?: string) => {
  const { user } = useAuth();
  const [starredMessages, setStarredMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStarredMessages = useCallback(async () => {
    if (!user || !chatId) {
      setStarredMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: chatMessages, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chatId);
      if (messagesError) throw messagesError;

      const messageIds = (chatMessages || []).map((message) => message.id);
      if (messageIds.length === 0) {
        setStarredMessages([]);
        return;
      }

      const { data, error } = await supabase
        .from('starred_messages')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', messageIds);

      if (error) throw error;

      setStarredMessages(data?.map(m => m.message_id) || []);
    } catch (error) {
      console.error('Error fetching starred messages:', error);
      setStarredMessages([]);
    } finally {
      setLoading(false);
    }
  }, [user, chatId]);

  useEffect(() => {
    void fetchStarredMessages();
  }, [fetchStarredMessages]);

  const starMessage = async (messageId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('starred_messages')
        .insert({
          message_id: messageId,
          user_id: user.id,
        });

      if (error) throw error;

      setStarredMessages((previous) => previous.includes(messageId) ? previous : [...previous, messageId]);
      toast({ title: 'Message starred' });
    } catch (error) {
      console.error('Error starring message:', error);
      toast({ title: 'Failed to star message', variant: 'destructive' });
    }
  };

  const unstarMessage = async (messageId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('starred_messages')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id);

      if (error) throw error;

      setStarredMessages((previous) => previous.filter(id => id !== messageId));
      toast({ title: 'Message unstarred' });
    } catch (error) {
      console.error('Error unstarring message:', error);
      toast({ title: 'Failed to unstar message', variant: 'destructive' });
    }
  };

  const isStarred = (messageId: string) => starredMessages.includes(messageId);

  return {
    starredMessages,
    loading,
    starMessage,
    unstarMessage,
    isStarred,
    refetch: fetchStarredMessages,
  };
};
