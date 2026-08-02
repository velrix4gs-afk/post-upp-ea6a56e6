import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFeed } from '@/hooks/useFeed';
import { useNavigate } from 'react-router-dom';
import { RealtimeFeed } from '@/components/RealtimeFeed';
import Navigation from '@/components/Navigation';
import Stories from '@/components/Stories';
import TrendingFeed from '@/components/TrendingFeed';
import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useInView } from 'react-intersection-observer';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefresh';
import { FeedTabs } from '@/components/feed/FeedTabs';
import { FeedSidebar } from '@/components/feed/FeedSidebar';
import CreatePostCard from '@/components/feed/CreatePostCard';
import { PostCardModern } from '@/components/PostCard/PostCardModern';
const Feed = () => {
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'for-you' | 'following' | 'trending'>('for-you');
  const {
    posts,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refreshSilently
  } = useFeed(activeTab === 'trending' ? 'for-you' : activeTab);
  const {
    ref: loadMoreRef,
    inView
  } = useInView();
  const {
    containerRef,
    isPulling,
    isRefreshing,
    pullDistance
  } = usePullToRefresh({
    onRefresh: async () => {
      await refreshSilently();
    }
  });
  const handleNewPost = () => {};
  useEffect(() => {
    if (inView && !loading && !loadingMore && hasMore) {
      const timer = setTimeout(() => {
        loadMore();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [inView, loading, loadingMore, hasMore, loadMore]);
  return <div ref={containerRef} className="min-h-screen bg-background touch-pan-y">
      <RealtimeFeed onNewPost={handleNewPost} />
      <PullToRefreshIndicator isPulling={isPulling} isRefreshing={isRefreshing} pullDistance={pullDistance} />
      <Navigation />
      
      <div className="container mx-auto px-0 lg:px-4 flex-row flex items-start justify-center gap-[130px]">
        {/* Left Sidebar */}
        <FeedSidebar />

        {/* Main Feed */}
        <main className="flex-1 max-w-2xl mx-auto lg:mx-0 min-h-screen pb-32 md:pb-20">
          <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Stories - scrolls with feed */}
          <div>
            <Stories />
          </div>

          {/* Create Post - Compact on mobile */}
          <div className="p-4 ">
            <CreatePostCard />
          </div>

          {/* Feed Content */}
          {activeTab === 'trending' ? <TrendingFeed /> : loading ? <div className="space-y-4 p-4">
              {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </div>
                </div>)}
            </div> : posts.length === 0 ? <div className="p-12 text-center">
              <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground">Be the first to share something!</p>
            </div> : <div className="space-y-4 p-4">
              {posts.map(post => <PostCardModern key={post.id} post={{
            id: post.id,
            content: post.content || '',
            media_url: post.media_url,
            media_urls: (post as any).media_urls || undefined,
            created_at: post.created_at,
            reactions_count: post.reactions_count,
            comments_count: post.comments_count,
            shares_count: post.shares_count || 0,
            author_name: post.profiles?.display_name || 'Unknown User',
            author_username: post.profiles?.username,
            author_avatar: post.profiles?.avatar_url,
            author_id: post.user_id,
            is_verified: post.profiles?.is_verified,
            verification_type: post.profiles?.verification_type,
            verified_at: post.profiles?.verified_at,
            page_id: post.page_id,
            page_name: (post as any).page?.name,
            page_username: (post as any).page?.username,
            page_avatar: (post as any).page?.avatar_url,
            page_is_verified: (post as any).page?.is_verified,
          }} />)}
              
              {hasMore && <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
                  {loadingMore && <Skeleton className="h-10 w-10 rounded-full" />}
                </div>}
            </div>}
        </main>
      </div>
      
    </div>;
};
export default Feed;