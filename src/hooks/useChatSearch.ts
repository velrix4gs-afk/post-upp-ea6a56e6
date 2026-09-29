import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Message } from './useMessages';

export const useChatSearch = (chatId?: string) => {
  const { user } = useAuth();
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const requestIdRef = useRef(0);

  const searchMessages = async (query: string) => {
    const normalizedQuery = query.trim();
    setSearchQuery(normalizedQuery);
    const requestId = ++requestIdRef.current;

    if (!user || !chatId || normalizedQuery.length < 3) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey (username, display_name, avatar_url)
        `)
        .eq('chat_id', chatId)
        .ilike('content', `%${normalizedQuery}%`)
        .not('deleted_for', 'cs', `{${user.id}}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (requestId !== requestIdRef.current) return;

      // Map the data to match Message interface
      const mappedResults = (data || []).map(msg => ({
        ...msg,
        updated_at: msg.created_at,
        sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender,
      })) as Message[];

      setSearchResults(mappedResults);
    } catch (error) {
      console.error('Error searching messages:', error);
      if (requestId === requestIdRef.current) setSearchResults([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const clearSearch = () => {
    requestIdRef.current += 1;
    setSearchResults([]);
    setSearchQuery('');
    setLoading(false);
  };

  return {
    searchResults,
    loading,
    searchQuery,
    searchMessages,
    clearSearch,
  };
};
