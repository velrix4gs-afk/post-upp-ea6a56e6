import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, TrendingUp, Users, MessageSquare, Heart, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsData {
  totalPosts: number;
  totalReactions: number;
  totalComments: number;
  totalFollowers: number;
  postEngagement: Array<{
    date: string;
    posts: number;
    reactions: number;
    comments: number;
  }>;
  topPosts: Array<{
    id: string;
    content: string;
    reactions_count: number;
    comments_count: number;
    shares_count: number;
  }>;
}

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalPosts: 0,
    totalReactions: 0,
    totalComments: 0,
    totalFollowers: 0,
    postEngagement: [],
    topPosts: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Total posts
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      // Total reactions on user's posts
      const { data: posts } = await supabase
        .from('posts')
        .select('id, reactions_count, comments_count, shares_count')
        .eq('user_id', user?.id);

      const totalReactions = posts?.reduce((sum, p) => sum + p.reactions_count, 0) || 0;
      const totalComments = posts?.reduce((sum, p) => sum + p.comments_count, 0) || 0;

      // Total followers
      const { count: followersCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user?.id)
        .eq('status', 'accepted');

      // Top posts
      const { data: topPosts } = await supabase
        .from('posts')
        .select('id, content, reactions_count, comments_count, shares_count')
        .eq('user_id', user?.id)
        .order('reactions_count', { ascending: false })
        .limit(5);

      // Engagement over time (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentPosts } = await supabase
        .from('posts')
        .select('created_at, reactions_count, comments_count')
        .eq('user_id', user?.id)
        .gte('created_at', sevenDaysAgo.toISOString());

      // Group by date
      const engagementByDate = new Map<string, { posts: number; reactions: number; comments: number }>();
      
      recentPosts?.forEach(post => {
        const date = new Date(post.created_at).toLocaleDateString();
        const existing = engagementByDate.get(date) || { posts: 0, reactions: 0, comments: 0 };
        engagementByDate.set(date, {
          posts: existing.posts + 1,
          reactions: existing.reactions + post.reactions_count,
          comments: existing.comments + post.comments_count
        });
      });

      const postEngagement = Array.from(engagementByDate.entries()).map(([date, data]) => ({
        date,
        ...data
      }));

      setAnalytics({
        totalPosts: postsCount || 0,
        totalReactions,
        totalComments,
        totalFollowers: followersCount || 0,
        postEngagement,
        topPosts: topPosts || []
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto p-4 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BarChart className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          </div>
          <p className="text-muted-foreground">Track your social media performance</p>
        </div>

        {/* Overview Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Posts</p>
                <p className="text-3xl font-bold">{analytics.totalPosts}</p>
              </div>
              <Eye className="h-8 w-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reactions</p>
                <p className="text-3xl font-bold">{analytics.totalReactions}</p>
              </div>
              <Heart className="h-8 w-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Comments</p>
                <p className="text-3xl font-bold">{analytics.totalComments}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Followers</p>
                <p className="text-3xl font-bold">{analytics.totalFollowers}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </Card>
        </div>

        <Tabs defaultValue="engagement" className="w-full">
          <TabsList>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="top-posts">Top Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="engagement" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Last 7 Days Activity
              </h3>
              
              {analytics.postEngagement.length > 0 ? (
                <div className="space-y-4">
                  {analytics.postEngagement.map(day => (
                    <div key={day.date} className="border-b pb-4 last:border-0">
                      <p className="font-medium mb-2">{day.date}</p>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Posts</p>
                          <p className="text-lg font-semibold">{day.posts}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Reactions</p>
                          <p className="text-lg font-semibold">{day.reactions}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Comments</p>
                          <p className="text-lg font-semibold">{day.comments}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No activity in the last 7 days</p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="top-posts" className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Your Top Performing Posts</h3>
              
              {analytics.topPosts.length > 0 ? (
                <div className="space-y-4">
                  {analytics.topPosts.map((post, index) => (
                    <div key={post.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="mb-2">{post.content?.substring(0, 100)}{post.content && post.content.length > 100 ? '...' : ''}</p>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span>{post.reactions_count} reactions</span>
                            <span>{post.comments_count} comments</span>
                            <span>{post.shares_count} shares</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No posts yet</p>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AnalyticsDashboard;
