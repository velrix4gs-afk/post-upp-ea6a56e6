import { useState, useEffect, useId } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { enqueueOfflineAction } from '@/lib/offlineQueue';
import { debug } from '@/lib/logger';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_urls?: string[] | null;
  media_type?: string;
  privacy: string;
  reactions_count: number;
  comments_count: number;
  shares_count?: number;
  created_at: string;
  updated_at: string;
  page_id?: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url?: string;
    is_verified: boolean;
    verification_type?: string | null;
    verified_at?: string | null;
  };
  page?: {
    name: string;
    username: string;
    avatar_url?: string;
    is_verified: boolean;
  } | null;
  reactions?: {
    id: string;
    user_id: string;
    reaction_type: string;
  }[];
}

export const usePosts = (userId?: string, enabled = true) => {
  const channelInstanceId = useId().replace(/:/g, '');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  const fetchPosts = async () => {
    if (!enabled) return;
    if (!session?.access_token) return;

    try {
      let postsQuery = supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url,
            is_verified,
            verification_type,
            verified_at
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (userId) postsQuery = postsQuery.eq('user_id', userId);
      const { data: postsData, error } = await postsQuery;

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }

      const postIds = (postsData || []).map((post) => post.id);
      const { data: reactions, error: reactionsError } = postIds.length
        ? await supabase.from('post_reactions').select('*').in('post_id', postIds)
        : { data: [], error: null };
      if (reactionsError) console.error('Error fetching post reactions:', reactionsError);
      const reactionsByPost = new Map<string, NonNullable<typeof reactions>>();
      (reactions || []).forEach((reaction) => {
        const list = reactionsByPost.get(reaction.post_id) || [];
        list.push(reaction);
        reactionsByPost.set(reaction.post_id, list);
      });
      const postsWithReactions = (postsData || []).map((post) => ({
        ...post,
        reactions: reactionsByPost.get(post.id) || [],
      }));

      setPosts(postsWithReactions || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async (postData: {
    content?: string;
    media_url?: string;
    media_urls?: string[];
    media_type?: string;
    privacy?: string;
  }): Promise<Post | { queued: true }> => {
    if (!session?.access_token) {
      throw new Error('You must be logged in to create a post');
    }

    if (!postData.content && !postData.media_url && !(postData.media_urls?.length)) {
      throw new Error('Post must have either content or media');
    }

    try {
      // If offline, queue the post
      if (!navigator.onLine) {
        enqueueOfflineAction('rpc', 'posts', postData);
        toast({
          title: 'Queued',
          description: 'Post will be published when you\'re back online',
        });
        return { queued: true };
      }

      debug('Creating post with data:', postData);
      
      const { data, error } = await supabase.functions.invoke('posts', {
        body: postData,
      });

      if (error) throw error;

      debug('Post creation response:', data);
      if (!data || typeof data !== 'object' || typeof data.id !== 'string') {
        throw new Error('Post service returned an invalid response');
      }

      // Real-time will handle adding to state, but also add optimistically
      setPosts(prevPosts => {
        if (prevPosts.some(p => p.id === data.id)) return prevPosts;
        return [data, ...prevPosts];
      });
      
      toast({
        title: 'Success',
        description: 'Post created successfully!',
      });

      return data;
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({
        description: `Could not create post • ERR002`,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updatePost = async (postId: string, postData: {
    content?: string;
    privacy?: string;
    media_url?: string | null;
    media_urls?: string[] | null;
    media_type?: string | null;
  }) => {
    if (!session?.access_token) {
      throw new Error('You must be logged in to update a post');
    }

    try {
      const { data, error } = await supabase.functions.invoke('posts', {
        body: { ...postData, postId },
        method: 'PUT',
      });

      if (error) throw error;

      setPosts(prevPosts =>
        prevPosts.map(post => (post.id === postId ? { ...post, ...data } : post))
      );
      
      toast({
        title: 'Success',
        description: 'Post updated successfully!',
      });

      return data;
    } catch (error: any) {
      console.error('Error updating post:', error);
      toast({
        description: `Could not update post • ERR003`,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deletePost = async (postId: string) => {
    if (!session?.access_token) {
      throw new Error('You must be logged in to delete a post');
    }

    try {
      const { error } = await supabase.functions.invoke('posts', {
        body: { postId, action: 'delete' },
      });

      if (error) throw error;

      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
      
      toast({
        description: 'Post deleted',
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({
        description: `Could not delete • ERR001`,
        variant: 'destructive',
      });
      throw error;
    }
  };

  const toggleReaction = async (postId: string, reactionType: string) => {
    if (!session?.access_token) return;

    try {
      const currentUserId = session.user?.id;
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post.id === postId) {
            const hasUserReaction = post.reactions?.some(r => r.user_id === currentUserId && r.reaction_type === reactionType);
            
            let newReactions = [...(post.reactions || [])];
            let newCount = post.reactions_count;
            
            if (hasUserReaction) {
              newReactions = newReactions.filter(r => !(r.user_id === currentUserId && r.reaction_type === reactionType));
              newCount = Math.max(0, newCount - 1);
            } else {
              newReactions = newReactions.filter(r => r.user_id !== currentUserId);
              newReactions.push({
                id: 'temp',
                user_id: currentUserId || '',
                reaction_type: reactionType
              });
              newCount = newCount + 1;
            }
            
            return {
              ...post,
              reactions_count: newCount,
              reactions: newReactions
            };
          }
          return post;
        })
      );

      // If offline, queue the reaction
      if (!navigator.onLine) {
        enqueueOfflineAction('rpc', 'reactions', {
          target_id: postId,
          target_type: 'post',
          reaction_type: reactionType,
        });
        return { queued: true };
      }

      const { data, error } = await supabase.functions.invoke('reactions', {
        body: {
          target_id: postId,
          target_type: 'post',
          reaction_type: reactionType,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error toggling reaction:', error);
      toast({
        description: `Could not update reaction • ERR004`,
        variant: 'destructive',
      });
      fetchPosts();
      throw error;
    }
  };

  useEffect(() => {
    if (!enabled) {
      setPosts([]);
      setLoading(true);
      return;
    }
    fetchPosts();

    // Real-time: handle INSERT/UPDATE/DELETE without full re-fetch
    const channel = supabase
      .channel(`posts-realtime:${channelInstanceId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts'
      }, async (payload) => {
        const newPost = payload.new as any;
        if (userId && newPost.user_id !== userId) return;
        
        // Fetch profile + reactions for the new post
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url, is_verified, verification_type, verified_at')
          .eq('id', newPost.user_id)
          .single();

        const { data: reactions } = await supabase
          .from('post_reactions')
          .select('*')
          .eq('post_id', newPost.id);

        const postWithProfile: Post = {
          ...newPost,
          profiles: profile || { username: 'unknown', display_name: 'Unknown', is_verified: false },
          reactions: reactions || []
        };

        setPosts(prev => {
          if (prev.some(p => p.id === postWithProfile.id)) return prev;
          return [postWithProfile, ...prev];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'posts'
      }, (payload) => {
        const updated = payload.new as any;
        if (userId && updated.user_id !== userId) return;
        setPosts(prev => prev.map(p => 
          p.id === updated.id ? { ...p, ...updated } : p
        ));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'posts'
      }, (payload) => {
        const deletedPost = payload.old as any;
        if (userId && deletedPost.user_id && deletedPost.user_id !== userId) return;
        const deletedId = deletedPost.id;
        setPosts(prev => prev.filter(p => p.id !== deletedId));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.access_token, channelInstanceId, userId, enabled]);

  return {
    posts,
    loading,
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
    toggleReaction,
  };
};
