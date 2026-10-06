import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LikedPost {
  id: string;
  content: string;
  media_url?: string;
  created_at: string;
  user_id: string;
  reactions_count: number;
  comments_count: number;
  profiles?: {
    display_name: string;
    username: string;
    avatar_url?: string;
    is_verified?: boolean;
  };
}

export const useUserLikes = (userId?: string) => {
  const [likedPosts, setLikedPosts] = useState<LikedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLikedPosts = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Get post IDs that the user has reacted to
      const { data: reactions, error: reactionsError } = await supabase
        .from('post_reactions')
        .select('post_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (reactionsError) throw reactionsError;

      if (!reactions || reactions.length === 0) {
        setLikedPosts([]);
        setLoading(false);
        return;
      }

      const postIds = reactions.map(r => r.post_id);

      // Fetch the actual posts
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          id,
          content,
          media_url,
          created_at,
          user_id,
          reactions_count,
          comments_count,
          profiles (
            display_name,
            username,
            avatar_url,
            is_verified
          )
        `)
        .in('id', postIds);

      if (postsError) throw postsError;

      // Sort by the order of reactions (most recent liked first)
      const postsMap = new Map((posts || []).map(p => [p.id, p]));
      const orderedPosts = postIds
        .map(id => postsMap.get(id))
        .filter(Boolean) as LikedPost[];

      setLikedPosts(orderedPosts);
    } catch (error) {
      console.error('Error fetching liked posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;

    fetchLikedPosts();

    // Real-time subscription for user's reactions
    const channel = supabase
      .channel(`user-likes-${userId}:${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_reactions',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchLikedPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { likedPosts, loading };
};