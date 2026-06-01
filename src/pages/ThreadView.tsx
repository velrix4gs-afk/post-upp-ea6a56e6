import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PostCard } from '@/components/PostCard';
import { ThreadedCommentsSection } from '@/components/ThreadedCommentsSection';
import Navigation from '@/components/Navigation';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export const ThreadView = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('id', postId)
        .single();

      if (error) {
        console.error('Error fetching post:', error);
      } else {
        setPost(data);
      }
      setLoading(false);
    };

    fetchPost();
  }, [postId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <BackNavigation title="Post" />
        <main className="max-w-2xl mx-auto border-x min-h-screen">
          <div className="p-4">
            <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-2xl mx-auto border-x min-h-screen p-12 text-center">
          <h2 className="text-xl font-semibold mb-2">Post not found</h2>
          <p className="text-muted-foreground mb-4">This post may have been deleted</p>
          <Button onClick={() => navigate('/feed')}>Go to Feed</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BackNavigation title="Post" />
      
      <main className="max-w-2xl mx-auto border-x min-h-screen">

        {/* Main Post */}
        <div className="border-b">
          <PostCard
            post={{
              id: post.id,
              content: post.content || '',
              media_url: post.media_url,
              created_at: post.created_at,
              reactions_count: post.reactions_count,
              comments_count: post.comments_count,
              shares_count: post.shares_count || 0,
              author_name: post.profiles?.display_name || 'Unknown User',
              author_avatar: post.profiles?.avatar_url,
              author_id: post.user_id,
            }}
          />
        </div>

        {/* Comments Thread */}
        <div className="p-4">
          <ThreadedCommentsSection postId={postId!} />
        </div>
      </main>
    </div>
  );
};

export default ThreadView;
