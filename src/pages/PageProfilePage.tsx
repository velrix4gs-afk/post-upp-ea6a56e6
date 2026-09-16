import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePages, Page } from '@/hooks/usePages';
import { useAuth } from '@/hooks/useAuth';
import { BackNavigation } from '@/components/BackNavigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Settings, Send, ImageIcon, CheckCircle, Globe, Mail, X, ThumbsUp, FileText } from 'lucide-react';
import { PostCardModern } from '@/components/PostCard/PostCardModern';
import { toast } from '@/hooks/use-toast';
import { GalleryPickerSheet } from '@/components/story/GalleryPickerSheet';

const PageProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getPageByUsername, followPage, unfollowPage, getPagePosts, createPagePost } = usePages();

  const [page, setPage] = useState<Page | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [showGallerySheet, setShowGallerySheet] = useState(false);

  const isOwnerOrAdmin = page?.user_role === 'owner' || page?.user_role === 'admin' || page?.user_role === 'editor' || (user && page?.created_by === user.id);

  useEffect(() => {
    if (username) loadPage();
  }, [username]);

  const loadPage = async () => {
    if (!username) return;
    setLoading(true);
    const pageData = await getPageByUsername(username);
    if (!pageData) {
      toast({ title: 'Page not found' });
      navigate('/pages');
      return;
    }
    setPage(pageData);
    const pagePosts = await getPagePosts(pageData.id);
    setPosts(pagePosts);
    setLoading(false);
  };

  const handleFollowToggle = async () => {
    if (!page) return;
    if (page.is_following) {
      await unfollowPage(page.id);
      setPage(prev => prev ? { ...prev, is_following: false, followers_count: prev.followers_count - 1 } : null);
    } else {
      await followPage(page.id);
      setPage(prev => prev ? { ...prev, is_following: true, followers_count: prev.followers_count + 1 } : null);
    }
  };

  const handleMediaSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
  };

  const handleCreatePost = async () => {
    if (!page || (!newPostContent.trim() && !mediaFile)) return;
    setPosting(true);
    try {
      await createPagePost(page.id, {
        content: newPostContent,
        mediaFile: mediaFile || undefined,
      });
      setNewPostContent('');
      clearMedia();
      const pagePosts = await getPagePosts(page.id);
      setPosts(pagePosts);
    } catch {
      // Error handled in hook
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b p-4">
          <BackNavigation />
        </div>
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <BackNavigation />
          <h1 className="text-lg font-bold truncate">{page.name}</h1>
          {isOwnerOrAdmin && (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/page/${page.id}/edit`)}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Cover */}
        <div className="h-48 bg-muted relative">
          {page.cover_url && (
            <img src={page.cover_url} alt="Cover" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Page Info */}
        <div className="px-4 -mt-12 relative z-[1]">
          <div className="flex items-end gap-4">
            <Avatar className="h-24 w-24 border-4 border-background">
              <AvatarImage src={page.avatar_url} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {page.name[0]}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{page.name}</h2>
              {page.is_verified && <CheckCircle className="h-5 w-5 text-primary" />}
            </div>
            <p className="text-muted-foreground text-sm">@{page.username}</p>
            {page.category && <Badge variant="secondary">{page.category}</Badge>}
            {page.description && (
              <p className="text-foreground text-sm">{page.description}</p>
            )}

            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="font-semibold text-foreground">{page.followers_count}</span> followers
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span className="font-semibold text-foreground">{posts.length}</span> posts
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {user && page.created_by !== user.id && (
                <Button
                  onClick={handleFollowToggle}
                  variant={page.is_following ? 'outline' : 'default'}
                  className="rounded-full"
                >
                  {page.is_following ? (
                    <>
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Liked
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Like Page
                    </>
                  )}
                </Button>
              )}
              {isOwnerOrAdmin && (
                <Button variant="outline" className="rounded-full" onClick={() => navigate(`/page/${page.id}/edit`)}>
                  Manage Page
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6">
          <Tabs defaultValue="posts" className="w-full">
            <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
              <TabsTrigger value="posts" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3">
                Posts
              </TabsTrigger>
              <TabsTrigger value="about" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3">
                About
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-0">
              {/* Create Post (for page admins) */}
              {isOwnerOrAdmin && (
                <div className="px-4 mt-4">
                  <Card className="p-4">
                    <Textarea
                      placeholder={`Post as ${page.name}...`}
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      className="min-h-[80px] resize-none border-0 focus-visible:ring-0 p-0"
                    />

                    {/* Media Preview */}
                    {mediaPreview && (
                      <div className="relative mt-3 rounded-lg overflow-hidden">
                        {mediaFile?.type.startsWith('video/') ? (
                          <video src={mediaPreview} className="max-h-64 w-full object-cover rounded-lg" controls />
                        ) : (
                          <img src={mediaPreview} alt="Preview" className="max-h-64 w-full object-cover rounded-lg" />
                        )}
                        <Button
                          size="icon"
                          variant="secondary"
                          className="absolute top-2 right-2 h-7 w-7 rounded-full"
                          onClick={clearMedia}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowGallerySheet(true)}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Photo/Video
                      </Button>
                      <Button
                        size="sm"
                        disabled={(!newPostContent.trim() && !mediaFile) || posting}
                        onClick={handleCreatePost}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {posting ? 'Posting...' : 'Post'}
                      </Button>
                    </div>
                    <GalleryPickerSheet
                      open={showGallerySheet}
                      onOpenChange={setShowGallerySheet}
                      title="Add to page post"
                      onSelect={handleMediaSelect}
                    />
                  </Card>
                </div>
              )}

              {/* Posts Feed */}
              <div className="mt-4 space-y-4 px-4">
                {posts.length === 0 ? (
                  <Card className="p-12 text-center">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No posts yet</p>
                  </Card>
                ) : (
                  posts.map((post: any) => (
                    <PostCardModern
                      key={post.id}
                      post={{
                        id: post.id,
                        content: post.content || '',
                        media_url: post.media_url,
                        created_at: post.created_at,
                        reactions_count: post.reactions_count || 0,
                        comments_count: post.comments_count || 0,
                        shares_count: post.shares_count || 0,
                        author_name: post.profiles?.display_name || page.name,
                        author_username: post.profiles?.username || page.username,
                        author_avatar: post.profiles?.avatar_url || page.avatar_url,
                        author_id: post.user_id,
                        is_verified: page.is_verified,
                        page_id: page.id,
                        page_name: page.name,
                        page_username: page.username,
                        page_avatar: page.avatar_url,
                        page_is_verified: page.is_verified,
                      }}
                    />
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="about" className="mt-0 px-4 pt-4">
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">About {page.name}</h3>

                {page.description && (
                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-1">Description</p>
                    <p className="text-sm text-foreground">{page.description}</p>
                  </div>
                )}

                {page.category && (
                  <div>
                    <p className="text-sm text-muted-foreground font-medium mb-1">Category</p>
                    <Badge variant="secondary">{page.category}</Badge>
                  </div>
                )}

                {page.website_url && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={page.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {page.website_url}
                    </a>
                  </div>
                )}

                {page.contact_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${page.contact_email}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {page.contact_email}
                    </a>
                  </div>
                )}

                {!page.description && !page.website_url && !page.contact_email && (
                  <p className="text-sm text-muted-foreground">No additional information available.</p>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default PageProfilePage;
