import Navigation from "@/components/Navigation";
import CreatePost from "@/components/CreatePost";
import { PostCard } from "@/components/PostCard";

import Showcase from "@/components/Showcase";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Plus,
  Camera
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { useFriends } from "@/hooks/useFriends";
import { useHashtags } from "@/hooks/useHashtags";
import { useFriendSuggestions } from "@/hooks/useFriendSuggestions";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { posts, loading: postsLoading } = usePosts();
  const { friends } = useFriends();
  const { trending, loading: hashtagsLoading } = useHashtags();
  const { suggestions, loading: suggestionsLoading } = useFriendSuggestions();
  
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            {/* User Profile Card */}
            <Card className="bg-gradient-card border-0 p-6">
              <div className="text-center">
                <div className="relative inline-block">
                  <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-gradient-primary text-white text-lg">
                      {profile?.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <Button size="sm" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 bg-primary hover:bg-primary/90">
                    <Camera className="h-4 w-4 text-white" />
                  </Button>
                </div>
                <h3 className="font-semibold mt-3">{profile?.display_name || 'Loading...'}</h3>
                <p className="text-sm text-muted-foreground">@{profile?.username || 'username'}</p>
                <div className="flex items-center justify-center space-x-4 mt-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold">{friends.length}</div>
                    <div className="text-muted-foreground">Friends</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">{posts.length}</div>
                    <div className="text-muted-foreground">Posts</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gradient-card border-0 p-4">
              <h3 className="font-semibold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <Link to="/friends">
                  <Button variant="ghost" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-3" />
                    Find Friends
                  </Button>
                </Link>
                <Link to="/events">
                  <Button variant="ghost" className="w-full justify-start">
                    <Calendar className="h-4 w-4 mr-3" />
                    Events
                  </Button>
                </Link>
                <Link to="/explore">
                  <Button variant="ghost" className="w-full justify-start">
                    <TrendingUp className="h-4 w-4 mr-3" />
                    Explore
                  </Button>
                </Link>
                <Link to="/groups">
                  <Button variant="ghost" className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-3" />
                    Groups
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* Main Feed */}
          <div className="lg:col-span-6 space-y-6">
            {/* Stories */}
            <Showcase />

            {/* Create Post */}
            <CreatePost />

            {/* Posts Feed */}
            <div className="space-y-6">
              {postsLoading ? (
                <div className="text-center py-8">Loading posts...</div>
              ) : posts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No posts yet. Create your first post above!
                </div>
              ) : (
                posts.map((post) => (
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
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            {/* Trending Topics */}
            <Card className="bg-gradient-card border-0 p-4">
              <h3 className="font-semibold mb-3">Trending Topics</h3>
              <div className="space-y-3">
                {hashtagsLoading ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
                ) : trending.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">No trending topics yet</div>
                ) : (
                  trending.slice(0, 4).map((hashtag) => (
                    <Link 
                      key={hashtag.id} 
                      to={`/hashtag/${hashtag.tag}`}
                      className="block cursor-pointer hover:bg-muted/20 p-2 rounded transition-colors"
                    >
                      <div className="font-medium text-sm text-primary">#{hashtag.tag}</div>
                      <div className="text-xs text-muted-foreground">
                        {hashtag.usage_count.toLocaleString()} {hashtag.usage_count === 1 ? 'post' : 'posts'}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>

            {/* Friend Suggestions */}
            <Card className="bg-gradient-card border-0 p-4">
              <h3 className="font-semibold mb-3">People You May Know</h3>
              <div className="space-y-3">
                {suggestionsLoading ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
                ) : suggestions.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">No suggestions available</div>
                ) : (
                  suggestions.slice(0, 3).map((person) => (
                    <div key={person.id} className="flex items-center justify-between">
                      <Link to={`/profile/${person.id}`} className="flex items-center space-x-3 flex-1">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={person.avatar_url} />
                          <AvatarFallback className="bg-gradient-primary text-white text-sm">
                            {person.display_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{person.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {person.mutual_friends_count > 0 
                              ? `${person.mutual_friends_count} mutual ${person.mutual_friends_count === 1 ? 'friend' : 'friends'}`
                              : 'Suggested for you'}
                          </p>
                        </div>
                      </Link>
                      <Link to={`/profile/${person.id}`}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;