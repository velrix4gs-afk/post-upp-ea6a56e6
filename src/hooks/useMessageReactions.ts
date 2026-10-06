import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Reaction {
  type: string;
  count: number;
  users: { id: string; name: string }[];
  hasReacted: boolean;
}

export const useMessageReactions = (messageId: string) => {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (messageId) {
      fetchReactions();

      // Subscribe to reaction changes
      const channel = supabase
        .channel(`reactions:${messageId}:${Math.random().toString(36).slice(2, 10)}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
          filter: `message_id=eq.${messageId}`
        }, () => {
          fetchReactions();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [messageId, user]);

  const fetchReactions = async () => {
    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('id, user_id, reaction_type, profiles:user_id(display_name)')
        .eq('message_id', messageId);

      if (error) throw error;

      // Group reactions by type
      const reactionMap = new Map<string, { users: any[]; hasReacted: boolean }>();
      
      data?.forEach(reaction => {
        const type = reaction.reaction_type;
        if (!reactionMap.has(type)) {
          reactionMap.set(type, { users: [], hasReacted: false });
        }
        
        const reactionData = reactionMap.get(type)!;
        reactionData.users.push({
          id: reaction.user_id,
          name: (reaction.profiles as any)?.display_name || 'User'
        });
        
        if (reaction.user_id === user?.id) {
          reactionData.hasReacted = true;
        }
      });

      const reactionsArray: Reaction[] = Array.from(reactionMap.entries()).map(([type, data]) => ({
        type,
        count: data.users.length,
        users: data.users,
        hasReacted: data.hasReacted
      }));

      setReactions(reactionsArray);
    } catch (error) {
      console.error('Error fetching reactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return { reactions, loading, refetch: fetchReactions };
};
