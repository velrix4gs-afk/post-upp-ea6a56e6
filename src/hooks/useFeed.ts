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
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loadingMoreRef = useRef(false);
  const postsRef = useRef<Post[]>([]);
  const feedTypeRef = useRef(feedType);
  feedTypeRef.current = feedType;

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const fetchFeed = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    if (!user) return;
    const isInitialPage = pageNum === 1 || reset;

    try {
      if (isInitialPage) {
        if (postsRef.current.length === 0) setLoading(true);
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
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
          if (isInitialPage) setPosts([]);
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
      // Stable chronological order for all tabs — random shuffling made the
      // feed jump around on every render and pagination.
      
      if (isInitialPage) {
        setPosts(newPosts);
        // Save to cache on fresh fetch
        CacheHelper.saveFeed(newPosts);
      } else {
        setPosts(prev => {
          const existingIds = new Set(prev.map((post) => post.id));
          const combined = [...prev, ...newPosts.filter((post) => !existingIds.has(post.id))];
          CacheHelper.saveFeed(combined);
          return combined;
        });
      }

      setHasMore(newPosts.length === limit);
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      if (isInitialPage) {
        setLoading(false);
      } else {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [user]);

  const loadMore = useCallback(() => {
    if (loading || loadingMoreRef.current || !hasMore) return;
    setPage(prevPage => {
      const nextPage = prevPage + 1;
      fetchFeed(nextPage, false);
      return nextPage;
    });
  }, [fetchFeed, hasMore, loading]);

  const refresh = () => {
    setPage(1);
    fetchFeed(1, true);
  };

  // Silent refresh — fetches latest page 1 and merges (dedupe by id) without
  // toggling the loading skeleton, so pull-to-refresh doesn't clear the feed.
  const refreshSilently = useCallback(async () => {
    if (!user) return;
    try {
      const limit = 10;
      let query = supabase
        .from('posts')
        .select(`
          id, user_id, content, media_url, media_type, privacy,
          reactions_count, comments_count, shares_count,
          created_at, updated_at, page_id,
          profiles:user_id ( username, display_name, avatar_url, is_verified ),
          page:pages ( name, username, avatar_url, is_verified )
        `)
        .eq('privacy', 'public')
        .order('created_at', { ascending: false })
        .range(0, limit - 1);

      if (feedTypeRef.current === 'following') {
        const { data: followingData } = await supabase
          .from('followers').select('following_id').eq('follower_id', user.id);
        const followingIds = followingData?.map(f => f.following_id) || [];
        const { data: followedPages } = await supabase
          .from('page_followers' as any).select('page_id').eq('user_id', user.id);
        const followedPageIds = ((followedPages || []) as any[]).map((f: any) => f.page_id);
        if (followingIds.length === 0 && followedPageIds.length === 0) return;
        const filters: string[] = [];
        if (followingIds.length > 0) filters.push(`user_id.in.(${followingIds.join(',')})`);
        if (followedPageIds.length > 0) filters.push(`page_id.in.(${followedPageIds.join(',')})`);
        query = query.or(filters.join(','));
      }

      const { data, error } = await query;
      if (error) return;
      const fresh = (data || []) as Post[];
      setPosts(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        for (const p of fresh) map.set(p.id, p);
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        CacheHelper.saveFeed(merged);
        return merged;
      });
    } catch {
      /* silent */
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      let cancelled = false;
      // Load cached feed first for instant display, then refresh without
      // replacing the visible feed with a full-page skeleton.
      const bootFeed = async () => {
        const cached = await CacheHelper.getFeed();
        if (cancelled) return;
        if (cached && cached.length > 0) {
          postsRef.current = cached;
          setPosts(cached);
          setLoading(false);
        }

        setPage(1);
        setHasMore(true);
        fetchFeed(1, true);
      };

      bootFeed();

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
        cancelled = true;
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id, feedType, fetchFeed]);

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    refreshSilently
  };
};
