import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserReply {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  post?: {
    id: string;
    content: string;
    user_id: string;
    profiles?: {
      display_name: string;
      username: string;
      avatar_url?: string;
    };
  };
}

export const useUserReplies = (userId?: string) => {
  const [replies, setReplies] = useState<UserReply[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReplies = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Two-step fetch: comments (public.comments has no declared FK to posts,
      // which is why the embedded join returned PGRST200). Fetch comments,
      // then fetch the referenced posts + their author profile separately.
      const { data: commentRows, error } = await supabase
        .from('comments')
        .select('id, content, created_at, post_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const postIds = Array.from(new Set((commentRows || []).map((c: any) => c.post_id).filter(Boolean)));
      let postMap: Record<string, any> = {};
      if (postIds.length) {
        const { data: postRows } = await supabase
          .from('posts')
          .select('id, content, user_id')
          .in('id', postIds);
        const authorIds = Array.from(new Set((postRows || []).map((p: any) => p.user_id).filter(Boolean)));
        let profileMap: Record<string, any> = {};
        if (authorIds.length) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', authorIds);
          profileMap = Object.fromEntries((profileRows || []).map((p: any) => [p.id, p]));
        }
        postMap = Object.fromEntries(
          (postRows || []).map((p: any) => [p.id, { ...p, profiles: profileMap[p.user_id] }])
        );
      }

      const formattedReplies = (commentRows || []).map((item: any) => ({
        id: item.id,
        content: item.content,
        created_at: item.created_at,
        post_id: item.post_id,
        post: postMap[item.post_id]
          ? {
              id: postMap[item.post_id].id,
              content: postMap[item.post_id].content,
              user_id: postMap[item.post_id].user_id,
              profiles: postMap[item.post_id].profiles,
            }
          : undefined,
      }));

      setReplies(formattedReplies);
    } catch (error) {
      console.error('Error fetching user replies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;

    fetchReplies();

    // Real-time subscription for user's comments/replies
    const channel = supabase
      .channel(`user-replies-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchReplies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { replies, loading };
};