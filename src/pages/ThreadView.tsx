import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ThreadedCommentsSection } from '@/components/ThreadedCommentsSection';
import Navigation from '@/components/Navigation';
import { BackNavigation } from '@/components/BackNavigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileHoverCard } from '@/components/ProfileHoverCard';
import { format } from 'date-fns';
import { profilePathFor } from '@/lib/profilePath';

export const ThreadView = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { hash } = useLocation();
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

  // Deep links from notifications: #comments scrolls to the thread, #comment-<id> to (and highlights) that comment.
  useEffect(() => {
    if (!hash || loading || !post) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (hash.startsWith('#comment-')) {
          el.classList.add('bg-primary/10');
          window.setTimeout(() => el.classList.remove('bg-primary/10'), 2500);
        }
        window.clearInterval(timer);
      } else if (tries > 20) {
        window.clearInterval(timer);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [hash, loading, post]);

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
                onClick={() => navigate(profilePathFor(post.profiles || { id: post.user_id }))}
              >
                <AvatarImage src={post.profiles?.avatar_url || undefined} alt={authorName} />
                <AvatarFallback>{authorName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </ProfileHoverCard>

            <div className="min-w-0 flex-1">
              <button
                onClick={() => navigate(profilePathFor(post.profiles || { id: post.user_id }))}
                className="block text-left"
              >
                <p className="font-semibold leading-tight truncate">{authorName}</p>
                {authorHandle && (
                  <p className="text-sm text-muted-foreground truncate">{authorHandle}</p>
                )}
              </button>
            </div>
          </div>

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
                    preload="metadata"
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

          {/* Caption */}
          {post.content && (
            <div className="mt-3 text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">
              {post.content.split(/(@\w+|#\w+)/g).map((part, i) => {
                if (part.startsWith('#')) return <button key={i} onClick={() => navigate(`/hashtag/${part.slice(1)}`)} className="text-primary hover:underline font-medium">{part}</button>;
                if (part.startsWith('@')) return <span key={i} className="text-primary font-medium">{part}</span>;
                return <span key={i}>{part}</span>;
              })}
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
        <div id="comments" className="p-4 scroll-mt-20">
          <ThreadedCommentsSection postId={postId!} />
        </div>
      </main>
    </div>
  );
};

export default ThreadView;
