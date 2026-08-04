import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ThreadedCommentsSection } from '@/components/ThreadedCommentsSection';
import Navigation from '@/components/Navigation';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileHoverCard } from '@/components/ProfileHoverCard';
import { format } from 'date-fns';

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
            username,
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

  const media: string[] = Array.isArray(post.media_urls) && post.media_urls.length
    ? post.media_urls
    : post.media_url
      ? [post.media_url]
      : [];
  const authorName = post.profiles?.display_name || 'Unknown User';
  const authorHandle = post.profiles?.username ? `@${post.profiles.username}` : '';
  const created = post.created_at ? new Date(post.created_at) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BackNavigation title="Post" />

      <main className="max-w-2xl mx-auto sm:border-x min-h-screen">
        {/* Detail header — author identity */}
        <article className="px-4 pt-4">
          <div className="flex items-start gap-3">
            <ProfileHoverCard userId={post.user_id}>
              <Avatar
                className="h-12 w-12 cursor-pointer"
                onClick={() => navigate(`/profile/${post.user_id}`)}
              >
                <AvatarImage src={post.profiles?.avatar_url || undefined} alt={authorName} />
                <AvatarFallback>{authorName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </ProfileHoverCard>

            <div className="min-w-0 flex-1">
              <button
                onClick={() => navigate(`/profile/${post.user_id}`)}
                className="block text-left"
              >
                <p className="font-semibold leading-tight truncate">{authorName}</p>
                {authorHandle && (
                  <p className="text-sm text-muted-foreground truncate">{authorHandle}</p>
                )}
              </button>
            </div>
          </div>

          {/* Full-size content */}
          {post.content && (
            <p className="mt-3 text-[19px] leading-[1.45] whitespace-pre-wrap break-words">
              {post.content}
            </p>
          )}

          {/* Media, full aspect ratio */}
          {media.length > 0 && (
            <div className="mt-3 space-y-2">
              {media.map((url: string, i: number) =>
                /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? (
                  <video
                    key={i}
                    src={url}
                    controls
                    playsInline
                    className="w-full rounded-2xl border border-border bg-black"
                  />
                ) : (
                  <img
                    key={i}
                    src={url}
                    alt={`Post media ${i + 1}`}
                    loading="lazy"
                    className="w-full rounded-2xl border border-border object-contain"
                  />
                ),
              )}
            </div>
          )}

          {/* Timestamp line */}
          {created && (
            <p className="mt-4 text-sm text-muted-foreground">
              {format(created, 'h:mm a')} · {format(created, 'MMM d, yyyy')}
            </p>
          )}

          {/* Stats bar */}
          <div className="mt-3 py-3 border-y border-border flex items-center gap-5 text-sm">
            <span>
              <strong>{post.reactions_count || 0}</strong>{' '}
              <span className="text-muted-foreground">Likes</span>
            </span>
            <span>
              <strong>{post.comments_count || 0}</strong>{' '}
              <span className="text-muted-foreground">Comments</span>
            </span>
            <span>
              <strong>{post.shares_count || 0}</strong>{' '}
              <span className="text-muted-foreground">Shares</span>
            </span>
          </div>
        </article>

        {/* Comments Thread */}
        <div className="p-4">
          <ThreadedCommentsSection postId={postId!} />
        </div>
      </main>
    </div>
  );
};

export default ThreadView;
