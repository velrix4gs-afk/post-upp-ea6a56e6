import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';
import { BackNavigation } from '@/components/BackNavigation';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, User, FileText, Users as UsersIcon, Hash } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearch } from "@/hooks/useSearch";
import { profilePathFor } from "@/lib/profilePath";
import { useFollowers } from '@/hooks/useFollowers';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchRecommendations } from '@/components/search/SearchRecommendations';
import { useHashtags } from '@/hooks/useHashtags';

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { results, loading, search } = useSearch();
  const { followUser, unfollowUser, following } = useFollowers();
  const { trending: trendingTags } = useHashtags();

  useEffect(() => {
    const debounce = setTimeout(() => {
      // search('') also clears previous results, so recommendations come back when the box is emptied.
      search(searchQuery);
    }, searchQuery.trim() ? 300 : 0);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const isFollowing = (userId: string) => {
    return following.some((f: any) => f?.following?.id === userId || f?.following_id === userId);
  };

  const handleFollowToggle = async (userId: string, isPrivate: boolean) => {
    if (isFollowing(userId)) {
      await unfollowUser(userId);
    } else {
      await followUser(userId, isPrivate);
    }
  };

  const userResults = results.filter(r => r.type === 'user');
  const postResults = results.filter(r => r.type === 'post');

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BackNavigation title="Search" />
      
      <main className="container mx-auto p-4 max-w-4xl">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search for users, posts, groups, or hashtags..."
              className="pl-10 h-12 text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="hashtags">Hashtags</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {loading ? (
              <Card className="p-4">
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : !searchQuery.trim() ? (
              <SearchRecommendations />
            ) : results.length === 0 && searchQuery ? (
              <Card className="p-8 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground">Try searching with different keywords</p>
              </Card>
            ) : (
              <>
                {userResults.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Users
                    </h3>
                    <div className="space-y-3">
                      {userResults.slice(0, 3).map(result => (
                        <div key={result.id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                          <div 
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                            onClick={() => navigate(profilePathFor(result.id, result.data?.username))}
                          >
                            <Avatar>
                              <AvatarImage src={result.avatar} />
                              <AvatarFallback>{result.title[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{result.title}</p>
                                {result.verified && (
                                  <Badge variant="secondary" className="h-4 px-1">✓</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant={isFollowing(result.id) ? "outline" : "default"}
                            onClick={() => handleFollowToggle(result.id, result.data.is_private)}
                          >
                            {isFollowing(result.id) ? 'Following' : 'Follow'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {postResults.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Posts
                    </h3>
                    <div className="space-y-3">
                      {postResults.slice(0, 3).map(result => (
                        <div key={result.id} className="p-3 hover:bg-muted rounded cursor-pointer" onClick={() => navigate(`/post/${result.id}`)}>
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={result.avatar} />
                              <AvatarFallback>{result.subtitle?.[0]}</AvatarFallback>
                            </Avatar>
                            <p className="text-sm font-medium">{result.subtitle}</p>
                          </div>
                          <p className="text-sm">{result.title}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4 mt-4">
            {loading ? (
              <Card className="p-4">
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              </Card>
            ) : userResults.length === 0 ? (
              <Card className="p-8 text-center">
                <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No users found</p>
              </Card>
            ) : (
              <Card className="p-4">
                <div className="space-y-3">
                  {userResults.map(result => (
                    <div key={result.id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => navigate(profilePathFor(result.id, result.data?.username))}
                      >
                        <Avatar>
                          <AvatarImage src={result.avatar} />
                          <AvatarFallback>{result.title[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{result.title}</p>
                            {result.verified && (
                              <Badge variant="secondary" className="h-4 px-1">✓</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant={isFollowing(result.id) ? "outline" : "default"}
                        onClick={() => handleFollowToggle(result.id, result.data.is_private)}
                      >
                        {isFollowing(result.id) ? 'Following' : 'Follow'}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="posts" className="space-y-4 mt-4">
            {loading ? (
              <Card className="p-4">
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              </Card>
            ) : postResults.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No posts found</p>
              </Card>
            ) : (
              <Card className="p-4">
                <div className="space-y-4">
                  {postResults.map(result => (
                    <div key={result.id} className="p-3 hover:bg-muted rounded cursor-pointer border-b last:border-0" onClick={() => navigate(`/post/${result.id}`)}>
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={result.avatar} />
                          <AvatarFallback>{result.subtitle?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{result.subtitle}</p>
                        </div>
                      </div>
                      <p className="text-sm mb-2">{result.title}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="groups" className="space-y-4 mt-4">
            <Card className="p-8 text-center">
              <UsersIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No groups found. Groups will appear here once they're created.</p>
            </Card>
          </TabsContent>

          <TabsContent value="hashtags" className="space-y-4 mt-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Hash className="h-5 w-5" />
                {searchQuery.trim() ? `Hashtags matching "${searchQuery.trim().replace(/^#/, '')}"` : 'Trending hashtags'}
              </h3>
              {(() => {
                const q = searchQuery.trim().replace(/^#/, '').toLowerCase();
                const tags = q ? trendingTags.filter((h) => h.tag.toLowerCase().includes(q)) : trendingTags;
                if (tags.length === 0) {
                  return q ? (
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                      onClick={() => navigate(`/hashtag/${encodeURIComponent(q)}`)}
                    >
                      Open #{q}
                    </button>
                  ) : (
                    <p className="text-sm text-muted-foreground">No trending hashtags yet.</p>
                  );
                }
                return (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => navigate(`/hashtag/${encodeURIComponent(h.tag)}`)}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm hover:bg-muted/70"
                      >
                        <Hash className="h-3.5 w-3.5 text-primary" />
                        {h.tag}
                        <span className="text-xs text-muted-foreground">· {h.usage_count}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SearchPage;