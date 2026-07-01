import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Post } from './usePosts';
import { CacheHelper } from '@/lib/asyncStorage';

export type FeedType = 'for-you' | 'following' | 'trending';

export const useFeed = (feedType: FeedType = 'for-you') => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const feedTypeRef = useRef(feedType);
  feedTypeRef.current = feedType;

  const fetchFeed = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    if (!user) return;

    try {
      setLoading(true);
      const limit = 10;
      const offset = (pageNum - 1) * limit;

      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          content,
          media_url,
          media_type,
          privacy,
          reactions_count,
          comments_count,
          shares_count,
          created_at,
          updated_at,
          page_id,
          profiles:user_id (
            username,
            display_name,
            avatar_url,
            is_verified
          ),
          page:pages (
            name,
            username,
            avatar_url,
            is_verified
          )
        `)
        .eq('privacy', 'public')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (feedTypeRef.current === 'following') {
        // Get followed users
        const { data: followingData } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', user.id);
        const followingIds = followingData?.map(f => f.following_id) || [];

        // Get followed pages
        const { data: followedPages } = await supabase
          .from('page_followers' as any)
          .select('page_id')
          .eq('user_id', user.id);
        const followedPageIds = ((followedPages || []) as any[]).map((f: any) => f.page_id);

        if (followingIds.length === 0 && followedPageIds.length === 0) {
          setPosts([]);
          setHasMore(false);
          return;
        }

        // Build OR filter: user posts from followed users + page posts from followed pages
        const filters: string[] = [];
        if (followingIds.length > 0) {
          filters.push(`user_id.in.(${followingIds.join(',')})`);
        }
        if (followedPageIds.length > 0) {
          filters.push(`page_id.in.(${followedPageIds.join(',')})`);
        }
        query = query.or(filters.join(','));
      }
      // 'for-you' → discovery: no author/page filter. Fetch all public
      // posts and lightly shuffle each page below so the mix feels random.

      const { data, error } = await query;

      if (error) throw error;

      let newPosts = (data || []) as Post[];

      // For You tab: shuffle within the fetched page for a random discovery mix
      if (feedTypeRef.current === 'for-you') {
        newPosts = [...newPosts].sort(() => Math.random() - 0.5);
      }
      
      if (reset) {
        setPosts(newPosts);
        // Save to cache on fresh fetch
        CacheHelper.saveFeed(newPosts);
      } else {
        setPosts(prev => {
          const combined = [...prev, ...newPosts];
          CacheHelper.saveFeed(combined);
          return combined;
        });
      }

      setHasMore(newPosts.length === limit);
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFeed(nextPage, false);
    }
  };

  const refresh = () => {
    setPage(1);
    fetchFeed(1, true);
  };

  useEffect(() => {
    if (user) {
      // Load cached feed first for instant display
      CacheHelper.getFeed().then(cached => {
        if (cached && cached.length > 0) {
          setPosts(cached);
          setLoading(false);
        }
      });

      setPage(1);
      setHasMore(true);
      fetchFeed(1, true);

      // Real-time subscription for posts
      const channel = supabase
        .channel(`feed-realtime-${feedType}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'posts'
        }, async (payload) => {
          const newPost = payload.new as any;
          if (newPost.privacy !== 'public') return;

          // Fetch profile for the new post
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url, is_verified')
            .eq('id', newPost.user_id)
            .single();

          const postWithProfile: Post = {
            ...newPost,
            profiles: profile || { username: 'unknown', display_name: 'Unknown', is_verified: false }
          };

          setPosts(prev => {
            if (prev.some(p => p.id === postWithProfile.id)) return prev;
            const updated = [postWithProfile, ...prev];
            CacheHelper.saveFeed(updated);
            return updated;
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts'
        }, (payload) => {
          const updated = payload.new as any;
          setPosts(prev => {
            const newPosts = prev.map(p => 
              p.id === updated.id ? { ...p, ...updated } : p
            );
            CacheHelper.saveFeed(newPosts);
            return newPosts;
          });
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'posts'
        }, (payload) => {
          const deletedId = (payload.old as any).id;
          setPosts(prev => {
            const filtered = prev.filter(p => p.id !== deletedId);
            CacheHelper.saveFeed(filtered);
            return filtered;
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, feedType, fetchFeed]);

  return {
    posts,
    loading,
    hasMore,
    loadMore,
    refresh
  };
};
