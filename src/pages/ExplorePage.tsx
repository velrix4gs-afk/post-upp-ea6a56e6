import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Users, Hash, Sparkles, UserPlus, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePosts } from '@/hooks/usePosts';
import { useFollowers } from '@/hooks/useFollowers';
import { useHashtags } from '@/hooks/useHashtags';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { PostCard } from '@/components/PostCard';

interface TrendingUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  is_verified: boolean;
  followers_count: number;
}

const ExplorePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { posts, loading: postsLoading } = usePosts();
  const { followUser, unfollowUser, following } = useFollowers();
  const { trending: trendingHashtags, loading: hashtagsLoading } = useHashtags();
  const [trendingUsers, setTrendingUsers] = useState<TrendingUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    fetchTrendingUsers();
  }, []);

  const fetchTrendingUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_verified')
        .neq('id', user?.id || '')
        .limit(10);

      if (error) throw error;

      // Get follower counts for each user
      const usersWithCounts = await Promise.all(
        (data || []).map(async (profile) => {
          const { count } = await supabase
            .from('followers')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', profile.id)
            .eq('status', 'accepted');

          return {
            ...profile,
            followers_count: count || 0
          };
        })
      );

      // Sort by follower count
      usersWithCounts.sort((a, b) => b.followers_count - a.followers_count);
      setTrendingUsers(usersWithCounts);
    } catch (error) {
      console.error('Error fetching trending users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const isFollowing = (userId: string) => {
    return following.some(f => f.following?.id === userId);
  };

  const handleFollowToggle = async (userId: string, isPrivate: boolean) => {
    if (isFollowing(userId)) {
      await unfollowUser(userId);
    } else {
      await followUser(userId, isPrivate);
    }
    fetchTrendingUsers();
  };

  // Get trending posts (most liked/commented in last 24h)
  const trendingPosts = [...posts]
    .sort((a, b) => (b.reactions_count + b.comments_count) - (a.reactions_count + a.comments_count))
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto p-4 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Explore</h1>
          </div>
          <p className="text-muted-foreground">Discover trending content and people</p>
        </div>

        <Tabs defaultValue="trending" className="w-full">
          <TabsList className="w-full justify-start mb-6">
            <TabsTrigger value="trending" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trending
            </TabsTrigger>
            <TabsTrigger value="people" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              People
            </TabsTrigger>
            <TabsTrigger value="hashtags" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Hashtags
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trending" className="space-y-4">
            {postsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4">
                    <div className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : trendingPosts.length > 0 ? (
              trendingPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    content: post.content || '',
                    media_url: post.media_url,
                    created_at: post.created_at,
                    reactions_count: post.reactions_count,
                    comments_count: post.comments_count,
                    author_name: post.profiles.display_name,
                    author_avatar: post.profiles.avatar_url,
                    author_id: post.user_id
                  }}
                />
              ))
            ) : (
              <Card className="p-12 text-center">
                <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No trending posts yet</h3>
                <p className="text-muted-foreground">Check back later for trending content</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="people" className="space-y-4">
            {loadingUsers ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : trendingUsers.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {trendingUsers.map(trendingUser => (
                  <Card 
                    key={trendingUser.id} 
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/profile/${trendingUser.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarImage src={trendingUser.avatar_url} />
                          <AvatarFallback className="bg-gradient-primary text-white">
                            {trendingUser.display_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="font-semibold">{trendingUser.display_name}</p>
                            {trendingUser.is_verified && (
                              <Badge variant="default" className="h-4 w-4 p-0 flex items-center justify-center">
                                ✓
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">@{trendingUser.username}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {trendingUser.followers_count} followers
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isFollowing(trendingUser.id) ? "outline" : "default"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollowToggle(trendingUser.id, false);
                        }}
                      >
                        {isFollowing(trendingUser.id) ? (
                          <>
                            <UserCheck className="h-4 w-4 mr-1" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-1" />
                            Follow
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No users to show</h3>
                <p className="text-muted-foreground">Be the first to create an account!</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="hashtags">
            {hashtagsLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </Card>
                ))}
              </div>
            ) : trendingHashtags.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trendingHashtags.map(hashtag => (
                  <Card 
                    key={hashtag.id}
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => navigate(`/hashtag/${hashtag.tag}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Hash className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {hashtag.tag}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {hashtag.usage_count} {hashtag.usage_count === 1 ? 'post' : 'posts'}
                        </p>
                      </div>
                      <TrendingUp className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Hash className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No hashtags yet</h3>
                <p className="text-muted-foreground">
                  Start using hashtags in your posts and they'll appear here
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ExplorePage;
