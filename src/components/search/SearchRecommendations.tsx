import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, TrendingUp, Flame, UserPlus, Heart, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useHashtags } from '@/hooks/useHashtags';
import { useFollowers } from '@/hooks/useFollowers';
import { profilePathFor } from '@/lib/profilePath';

interface SuggestedAccount {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  is_private: boolean | null;
}

interface PopularPost {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  reactions_count: number | null;
  comments_count: number | null;
  profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

/** Shown under "All" while the search box is empty. */
export const SearchRecommendations = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trending, loading: tagsLoading } = useHashtags();
  const { following, followUser, unfollowUser } = useFollowers();
  const [accounts, setAccounts] = useState<SuggestedAccount[] | null>(null);
  const [posts, setPosts] = useState<PopularPost[] | null>(null);

  const followingIds = new Set<string>(
    (following || []).map((f: any) => f?.following_id || f?.following?.id).filter(Boolean),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Suggested accounts: complete profiles the user doesn't follow yet (and isn't themselves).
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_verified, is_private')
        .eq('is_profile_complete', true)
        .order('created_at', { ascending: false })
        .limit(40);
      // Popular public posts from the last 30 days, most reacted first.
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: pops } = await supabase
        .from('posts')
        .select('id, content, media_url, media_type, reactions_count, comments_count, profiles:user_id (username, display_name, avatar_url)')
        .eq('privacy', 'public')
        .eq('is_deleted', false)
        .gte('created_at', since)
        .order('reactions_count', { ascending: false, nullsFirst: false })
        .limit(8);
      if (cancelled) return;
      setAccounts((profs as SuggestedAccount[]) || []);
      setPosts((pops as unknown as PopularPost[]) || []);
    })();
    return () => { cancelled = true; };
  }, []);

  const toFollow = (accounts || [])
    .filter((a) => a.id !== user?.id && !followingIds.has(a.id))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" /> Trending hashtags
        </h3>
        {tagsLoading && trending.length === 0 ? (
          <div className="flex flex-wrap gap-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}</div>
        ) : trending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trending hashtags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {trending.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => navigate(`/hashtag/${encodeURIComponent(h.tag)}`)}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm hover:bg-muted/70 transition-colors"
              >
                <Hash className="h-3.5 w-3.5 text-primary" />
                {h.tag}
                <span className="text-xs text-muted-foreground">· {h.usage_count}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <UserPlus className="h-5 w-5" /> Suggested accounts
        </h3>
        {accounts === null ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : toFollow.length === 0 ? (
          <p className="text-sm text-muted-foreground">You're following everyone we can suggest right now.</p>
        ) : (
          <div className="space-y-2">
            {toFollow.map((a) => {
              const isFollowing = followingIds.has(a.id);
              return (
                <div key={a.id} className="flex items-center justify-between rounded p-2 hover:bg-muted">
                  <div
                    className="flex flex-1 cursor-pointer items-center gap-3 min-w-0"
                    onClick={() => navigate(profilePathFor(a.id, a.username || undefined))}
                  >
                    <Avatar>
                      <AvatarImage src={a.avatar_url || undefined} />
                      <AvatarFallback>{(a.display_name || a.username || '?')[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate">{a.display_name || a.username}</p>
                        {a.is_verified && <Badge variant="secondary" className="h-4 px-1">✓</Badge>}
                      </div>
                      {a.username && <p className="text-sm text-muted-foreground truncate">@{a.username}</p>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isFollowing ? 'outline' : 'default'}
                    onClick={() => (isFollowing ? unfollowUser(a.id) : followUser(a.id, !!a.is_private))}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Flame className="h-5 w-5" /> Popular posts
        </h3>
        {posts === null ? (
          <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No popular posts yet.</p>
        ) : (
          <div className="space-y-1">
            {posts.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/post/${p.id}`)}
                className="flex cursor-pointer gap-3 rounded p-2 hover:bg-muted"
              >
                {p.media_url && p.media_type?.startsWith('image') && (
                  <img src={p.media_url} alt="" loading="lazy" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {p.profiles?.display_name || p.profiles?.username || 'User'}
                  </p>
                  <p className="line-clamp-2 text-sm">{p.content || (p.media_url ? 'Photo/video post' : '')}</p>
                  <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{p.reactions_count ?? 0}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments_count ?? 0}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default SearchRecommendations;
