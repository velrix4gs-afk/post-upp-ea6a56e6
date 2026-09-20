import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useHashtags } from '@/hooks/useHashtags';
import Navigation from '@/components/Navigation';
import { BackNavigation } from '@/components/BackNavigation';
import { PostCard } from '@/components/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Hash } from 'lucide-react';

const HashtagPage = () => {
  const { tag } = useParams<{ tag: string }>();
  const { getPostsByHashtag, loading } = useHashtags();
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    if (tag) {
      loadPosts();
    }
  }, [tag]);

  const loadPosts = async () => {
    if (!tag) return;
    const data = await getPostsByHashtag(tag);
    setPosts(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <BackNavigation title={`#${tag}`} />
        <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BackNavigation title={`#${tag}`} />

      <main className="container max-w-2xl mx-auto px-4 py-6">

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <Hash className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground">
              Be the first to post with #{tag}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={{
                id: post.id,
                content: post.content || '',
                media_url: post.media_url,
                media_urls: post.media_urls || undefined,
                created_at: post.created_at,
                reactions_count: post.reactions_count,
                comments_count: post.comments_count,
                shares_count: post.shares_count || 0,
                author_name: post.profiles?.display_name || 'Unknown User',
                author_username: post.profiles?.username,
                author_avatar: post.profiles?.avatar_url,
                author_id: post.user_id,
                is_verified: post.profiles?.is_verified,
              }} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HashtagPage;