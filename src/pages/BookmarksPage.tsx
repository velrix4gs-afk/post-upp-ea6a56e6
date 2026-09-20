import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBookmarks } from '@/hooks/useBookmarks';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import { BackNavigation } from '@/components/BackNavigation';
import { PostCardModern } from '@/components/PostCard/PostCardModern';
import { Card } from '@/components/ui/card';
import { Post } from '@/hooks/usePosts';
import { Bookmark } from 'lucide-react';

const BookmarksPage = () => {
  const { user } = useAuth();
  const { bookmarkedPosts, loading: bookmarksLoading } = useBookmarks();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && bookmarkedPosts.length > 0) {
      fetchBookmarkedPosts();
    } else {
      setLoading(false);
    }
  }, [user, bookmarkedPosts]);

  const fetchBookmarkedPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          ),
          post_reactions (
            id,
            user_id,
            reaction_type
          )
        `)
        .in('id', bookmarkedPosts)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPosts(data as any || []);
    } catch (err: any) {
      console.error('Failed to fetch bookmarked posts:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BackNavigation title="Bookmarks" />

      <main className="container mx-auto p-4 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="h-6 w-6" />
            Saved Posts
          </h1>
          <p className="text-muted-foreground mt-1">
            Posts you've bookmarked for later
          </p>
        </div>

        {loading || bookmarksLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="p-8 text-center">
            <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No saved posts yet</h3>
            <p className="text-muted-foreground">
              Bookmark posts to save them for later
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCardModern key={post.id} post={{
                id: post.id,
                content: post.content || '',
                media_url: post.media_url,
                media_urls: (post as any).media_urls || undefined,
                created_at: post.created_at,
                reactions_count: post.reactions_count,
                comments_count: post.comments_count,
                shares_count: (post as any).shares_count || 0,
                author_name: (post as any).profiles?.display_name || 'Unknown User',
                author_username: (post as any).profiles?.username,
                author_avatar: (post as any).profiles?.avatar_url,
                author_id: (post as any).user_id,
                is_verified: (post as any).profiles?.is_verified,
              }} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default BookmarksPage;