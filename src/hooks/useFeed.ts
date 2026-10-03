import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Post } from './usePosts';
import { CacheHelper } from '@/lib/asyncStorage';
import { AFFINITY_PROFILE_UPDATED_EVENT, loadAffinityProfile, startAffinitySession } from '@/lib/affinityProfile';
import { rankAndBlendFeedPosts } from '@/lib/feedBuckets';

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
      const limit = feedTypeRef.current === 'for-you' ? 50 : 10;
      const offset = (pageNum - 1) * limit;

      let query = supabase
        .from('posts')
        .select(`
          id,
          user_id,
          content,
          media_url,
          media_type,
          media_urls,
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
        .eq('is_deleted', false)
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
      // For You queries a wider real-post candidate set so the personalized,
      // trending, and discovery buckets can be blended at their target ratios.

      const { data, error } = await query;

      if (error) throw error;

      const newPosts = (data || []) as Post[];
      const ranked = feedTypeRef.current === 'for-you'
        ? rankAndBlendFeedPosts(newPosts)
        : newPosts;

      if (isInitialPage) {
        setPosts(ranked);
        // Save to cache on fresh fetch
        CacheHelper.saveFeed(ranked);
      } else {
        setPosts(prev => {
          const existingIds = new Set(prev.map((post) => post.id));
          const combined = [...prev, ...ranked.filter((post) => !existingIds.has(post.id))];
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
      const limit = feedTypeRef.current === 'for-you' ? 50 : 10;
      let query = supabase
        .from('posts')
        .select(`
          id, user_id, content, media_url, media_type, media_urls, privacy,
          reactions_count, comments_count, shares_count,
          created_at, updated_at, page_id,
          profiles:user_id ( username, display_name, avatar_url, is_verified ),
          page:pages ( name, username, avatar_url, is_verified )
        `)
        .eq('privacy', 'public')
        .eq('is_deleted', false)
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
      if (error) throw error;
      const fresh = (data || []) as Post[];
      setPosts(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        for (const p of fresh) map.set(p.id, p);
        const all = Array.from(map.values());
        const merged = feedTypeRef.current === 'for-you'
          ? rankAndBlendFeedPosts(all)
          : all.sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
        CacheHelper.saveFeed(merged);
        return merged;
      });
    } catch (error) {
      console.error('Error silently refreshing feed:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      let cancelled = false;
      // Start the affinity session (daily decay + session reset) — silent.
      startAffinitySession();
      // Load cached feed first for instant display, then refresh without
      // replacing the visible feed with a full-page skeleton.
      const bootFeed = async () => {
        const cached = await CacheHelper.getFeed();
        if (cancelled) return;
        if (cached && cached.length > 0) {
          const visibleCached = feedTypeRef.current === 'for-you'
            ? rankAndBlendFeedPosts(cached as Post[])
            : cached as Post[];
          postsRef.current = visibleCached;
          setPosts(visibleCached);
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
          if (newPost.privacy !== 'public' || newPost.is_deleted) return;

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
            const updated = feedTypeRef.current === 'for-you'
              ? rankAndBlendFeedPosts([postWithProfile, ...prev])
              : [postWithProfile, ...prev];
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
            if (updated.privacy !== 'public' || updated.is_deleted) {
              const filtered = prev.filter(post => post.id !== updated.id);
              CacheHelper.saveFeed(filtered);
              return filtered;
            }
            const changed = prev.map(p =>
              p.id === updated.id ? { ...p, ...updated } : p
            );
            const newPosts = feedTypeRef.current === 'for-you'
              ? rankAndBlendFeedPosts(changed)
              : changed;
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

      const rerankUnseen = () => {
        if (feedTypeRef.current !== 'for-you') return;
        const viewedIds = new Set(loadAffinityProfile().session.viewedPostIds);
        setPosts(current => {
          if (current.length < 2) return current;
          const ranked = rankAndBlendFeedPosts(current);
          const unseen = ranked.filter(post => !viewedIds.has(post.id));
          const next = current.map(post =>
            viewedIds.has(post.id) ? post : unseen.shift() || post
          );
          CacheHelper.saveFeed(next);
          return next;
        });
      };
      window.addEventListener(AFFINITY_PROFILE_UPDATED_EVENT, rerankUnseen);

      return () => {
        cancelled = true;
        window.removeEventListener(AFFINITY_PROFILE_UPDATED_EVENT, rerankUnseen);
        supabase.removeChannel(channel);
      };
    }
  }, [user, feedType, fetchFeed]);

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
