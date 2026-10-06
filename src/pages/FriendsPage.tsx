import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { BackNavigation } from '@/components/BackNavigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, UserMinus, UserCheck, X, Check, MessageSquare } from 'lucide-react';
import { useFriends } from '@/hooks/useFriends';
import { useFollowers } from '@/hooks/useFollowers';
import { profilePath } from '@/lib/profilePath';
import { useSearch } from '@/hooks/useSearch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

const FriendsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    friends, 
    pendingRequests, 
    sentRequests,
    loading,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    sendFriendRequest
  } = useFriends();
  
  const { 
    following, 
    followers,
    loading: followersLoading,
    unfollowUser 
  } = useFollowers(user?.id);
  
  const { results, search } = useSearch();

  useEffect(() => {
    if (searchQuery.trim()) {
      const debounce = setTimeout(() => {
        search(searchQuery);
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [searchQuery]);

  const filteredFriends = friends.filter(friend =>
    friend.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineFriends = filteredFriends; // TODO: Add online status tracking
  const suggestions = results.filter(r => 
    r.type === 'user' && 
    !friends.some(f => f.id === r.id) &&
    !pendingRequests.some(req => req.requester.id === r.id) &&
    !sentRequests.some(req => req.addressee.id === r.id)
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BackNavigation title="Friends" />
      
      <main className="container mx-auto p-4 max-w-6xl">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search friends..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="inline-flex w-full overflow-x-auto overflow-y-hidden mb-6 lg:grid lg:grid-cols-6 h-auto p-1">
            <TabsTrigger value="all" className="flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0">
              <span>Friends</span>
              <Badge variant="secondary" className="h-5 px-2">{friends.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="following" className="flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0">
              <span>Following</span>
              <Badge variant="secondary" className="h-5 px-2">{following.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="followers" className="flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0">
              <span>Followers</span>
              <Badge variant="secondary" className="h-5 px-2">{followers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="online" className="flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0">
              <span>Online</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0">
              <span>Requests</span>
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="h-5 px-2">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="flex items-center justify-center gap-2 whitespace-nowrap flex-shrink-0">
              <span>Suggestions</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {loading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredFriends.length === 0 ? (
              <Card className="p-12 text-center">
                <UserCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No friends yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start connecting with people to build your network!
                </p>
                <Button onClick={() => navigate('/search')}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Find Friends
                </Button>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFriends.map(friend => (
                  <Card key={friend.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar 
                          className="h-16 w-16 cursor-pointer" 
                          onClick={() => navigate(profilePath({ username: friend.username || friend.display_name, id: friend.id }))}
                        >
                          <AvatarImage src={friend.avatar_url} />
                          <AvatarFallback>{friend.display_name[0]}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p 
                            className="font-medium truncate cursor-pointer hover:underline"
                            onClick={() => navigate(profilePath({ username: friend.username || friend.display_name, id: friend.id }))}
                          >
                            {friend.display_name}
                          </p>
                          {friend.is_verified && (
                            <Badge variant="secondary" className="h-4 px-1">✓</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">@{friend.username}</p>
                        <div className="flex gap-2 mt-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => navigate('/messages')}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => removeFriend(friend.id)}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="following" className="mt-6">
            {followersLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : following.length === 0 ? (
              <Card className="p-12 text-center">
                <UserPlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Not following anyone yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start following people to see their content!
                </p>
                <Button onClick={() => navigate('/explore')}>
                  <Search className="h-4 w-4 mr-2" />
                  Discover People
                </Button>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {following.map(follow => (
                  <Card key={follow.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar 
                        className="h-16 w-16 cursor-pointer"
                        onClick={() => navigate(profilePath({ username: follow.following.username || follow.following.display_name, id: follow.following.id }))}
                      >
                        <AvatarImage src={follow.following.avatar_url} />
                        <AvatarFallback>{follow.following.display_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p 
                            className="font-medium truncate cursor-pointer hover:underline"
                            onClick={() => navigate(profilePath({ username: follow.following.username || follow.following.display_name, id: follow.following.id }))}
                          >
                            {follow.following.display_name}
                          </p>
                          {follow.following.is_verified && (
                            <Badge variant="secondary" className="h-4 px-1">✓</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">@{follow.following.username}</p>
                        <div className="flex gap-2 mt-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => navigate('/messages')}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => unfollowUser(follow.following.id)}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="followers" className="mt-6">
            {followersLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-16 w-16 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : followers.length === 0 ? (
              <Card className="p-12 text-center">
                <UserCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No followers yet</h3>
                <p className="text-muted-foreground">
                  Share your profile to gain followers!
                </p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {followers.map(follow => (
                  <Card key={follow.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar 
                        className="h-16 w-16 cursor-pointer"
                        onClick={() => navigate(profilePath({ username: follow.follower.username || follow.follower.display_name, id: follow.follower.id }))}
                      >
                        <AvatarImage src={follow.follower.avatar_url} />
                        <AvatarFallback>{follow.follower.display_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p 
                            className="font-medium truncate cursor-pointer hover:underline"
                            onClick={() => navigate(profilePath({ username: follow.follower.username || follow.follower.display_name, id: follow.follower.id }))}
                          >
                            {follow.follower.display_name}
                          </p>
                          {follow.follower.is_verified && (
                            <Badge variant="secondary" className="h-4 px-1">✓</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">@{follow.follower.username}</p>
                        <div className="flex gap-2 mt-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => navigate('/messages')}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => navigate(profilePath({ username: follow.follower.username || follow.follower.display_name, id: follow.follower.id }))}
                          >
                            View Profile
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="online" className="mt-6">
            {onlineFriends.length === 0 ? (
              <Card className="p-12 text-center">
                <UserCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No friends online</h3>
                <p className="text-muted-foreground">
                  None of your friends are currently online
                </p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {onlineFriends.map(friend => (
                  <Card key={friend.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar 
                          className="h-16 w-16 cursor-pointer"
                          onClick={() => navigate(profilePath({ username: friend.username || friend.display_name, id: friend.id }))}
                        >
                          <AvatarImage src={friend.avatar_url} />
                          <AvatarFallback>{friend.display_name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 rounded-full border-2 border-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p 
                            className="font-medium truncate cursor-pointer hover:underline"
                            onClick={() => navigate(profilePath({ username: friend.username || friend.display_name, id: friend.id }))}
                          >
                            {friend.display_name}
                          </p>
                          {friend.is_verified && (
                            <Badge variant="secondary" className="h-4 px-1">✓</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">@{friend.username}</p>
                        <Badge variant="outline" className="mt-2">Online</Badge>
                        <div className="flex gap-2 mt-3">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => navigate('/messages')}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-6">
            {pendingRequests.length === 0 ? (
              <Card className="p-12 text-center">
                <UserPlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No pending requests</h3>
                <p className="text-muted-foreground">
                  You don't have any friend requests at the moment
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <Card key={request.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar 
                        className="h-14 w-14 cursor-pointer"
                        onClick={() => navigate(`/profile/${request.requester.id}`)}
                      >
                        <AvatarImage src={request.requester.avatar_url} />
                        <AvatarFallback>{request.requester.display_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <p 
                            className="font-medium cursor-pointer hover:underline"
                            onClick={() => navigate(`/profile/${request.requester.id}`)}
                          >
                            {request.requester.display_name}
                          </p>
                          {request.requester.is_verified && (
                            <Badge variant="secondary" className="h-4 px-1">✓</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">@{request.requester.username}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          onClick={() => acceptFriendRequest(request.requester_id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => declineFriendRequest(request.requester_id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggestions" className="mt-6">
            {suggestions.length === 0 ? (
              <Card className="p-12 text-center">
                <UserPlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No suggestions available</h3>
                <p className="text-muted-foreground mb-6">
                  Try searching for people you know
                </p>
                <Button onClick={() => navigate('/search')}>
                  <Search className="h-4 w-4 mr-2" />
                  Search Users
                </Button>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggestions.map(user => (
                  <Card key={user.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar 
                        className="h-16 w-16 cursor-pointer"
                        onClick={() => navigate(`/profile/${user.id}`)}
                      >
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback>{user.title[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p 
                            className="font-medium truncate cursor-pointer hover:underline"
                            onClick={() => navigate(`/profile/${user.id}`)}
                          >
                            {user.title}
                          </p>
                          {user.verified && (
                            <Badge variant="secondary" className="h-4 px-1">✓</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{user.subtitle}</p>
                        <div className="flex gap-2 mt-3">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => sendFriendRequest(user.id)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add Friend
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default FriendsPage;