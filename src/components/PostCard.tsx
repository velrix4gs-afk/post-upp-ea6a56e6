import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2, UserPlus, UserMinus, BellOff, AlertCircle, Ban, UserCircle, Pin, PinOff, MessageCircle, Repeat2, Share2, Bookmark } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePosts } from "@/hooks/usePosts";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useFollowers } from "@/hooks/useFollowers";
import { useBlockedUsers } from "@/hooks/useBlockedUsers";
import { useReposts } from "@/hooks/useReposts";
import { usePinnedPosts } from "@/hooks/usePinnedPosts";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { PostContent } from "./PostContent";
import { CommentsSection } from "./CommentsSection";
import { SharePostDialog } from "./SharePostDialog";
import { TipDialog } from "./premium/TipDialog";
import { ImageGalleryViewer } from "./ImageGalleryViewer";
import { PostCardActions } from "./PostCard/PostCardActions";
import { VideoViewer } from "./VideoViewer";
import { ReportDialog } from "./ReportDialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { PostReactionPicker } from "./PostReactionPicker";
import { useReactions } from "@/hooks/useReactions";
import { ThreadedCommentsSection } from "./ThreadedCommentsSection";
import { cn } from "@/lib/utils";
import { VerificationBadge } from "./premium/VerificationBadge";
import { ProfileHoverCard } from "./ProfileHoverCard";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export interface PostCardProps {
  post: {
    id: string;
    content: string;
    media_url?: string;
    created_at: string;
    reactions_count: number;
    comments_count: number;
    shares_count?: number;
    author_name: string;
    author_avatar?: string;
    author_id: string;
    is_verified?: boolean;
    verification_type?: string | null;
    verified_at?: string | null;
  };
}

export const PostCard = ({ post }: PostCardProps) => {
  const { user } = useAuth();
  const { updatePost, deletePost } = usePosts();
  const { toggleBookmark, isBookmarked } = useBookmarks();
  const { followUser, unfollowUser, following } = useFollowers();
  const { blockUser } = useBlockedUsers();
  const { toggleRepost, isReposted } = useReposts();
  const { pinPost, unpinPost, isPinned } = usePinnedPosts();
  const { userReaction, reactionCounts, toggleReaction: handleReactionToggle, getTotalReactions } = useReactions(post.id);
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [localReactionCount, setLocalReactionCount] = useState(post.reactions_count);
  const [localRepostCount, setLocalRepostCount] = useState(post.shares_count || 0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);

  const isOwner = user?.id === post.author_id;
  const isFollowingAuthor = following.some(f => f.following?.id === post.author_id);

  const handleFollowToggle = async () => {
    if (isFollowingAuthor) {
      await unfollowUser(post.author_id);
      toast({
        title: 'Success',
        description: 'Unfollowed user',
      });
    } else {
      await followUser(post.author_id, false);
      toast({
        title: 'Success',
        description: 'Following user',
      });
    }
  };

  const handleMuteUser = () => {
    toast({
      title: 'Mute User',
      description: 'Mute feature coming soon',
    });
  };

  const handleReportPost = () => {
    setShowReportDialog(true);
  };

  const handlePinToggle = async () => {
    if (isPinned(post.id)) {
      await unpinPost(post.id);
    } else {
      await pinPost(post.id);
    }
  };

  const handleBlockUser = async () => {
    await blockUser(post.author_id, 'Blocked from post');
    toast({
      title: 'User Blocked',
      description: 'This user has been blocked',
    });
  };

  // Update local reaction count when post prop changes
  useEffect(() => {
    setLocalReactionCount(getTotalReactions());
  }, [reactionCounts]);

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    await updatePost(post.id, { content: editContent });
    setShowEditDialog(false);
    toast({ title: "Post updated" });
  };

  const handleDelete = async () => {
    await deletePost(post.id);
    setShowDeleteDialog(false);
    toast({ title: "Post deleted" });
  };

  const handleRepost = async () => {
    if (!user) return;
    
    const wasReposted = isReposted(post.id);
    setLocalRepostCount(prev => wasReposted ? Math.max(0, prev - 1) : prev + 1);
    
    try {
      await toggleRepost(post.id);
      toast({
        title: wasReposted ? 'Repost removed' : 'Reposted',
        description: wasReposted ? 'Post unreposted' : 'Post reposted to your followers'
      });
    } catch (error) {
      setLocalRepostCount(post.shares_count || 0);
      toast({
        title: 'Error',
        description: 'Failed to update repost',
        variant: 'destructive'
      });
    }
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    navigate(`/post/${post.id}`);
  };

  return (
    <>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEdit}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      <article 
        className="border-b hover:bg-muted/30 transition-all duration-200 cursor-pointer active:bg-muted/50"
        onClick={handleCardClick}
      >
        <div className="p-4 flex gap-3">
          <Avatar 
            className="cursor-pointer avatar-hover flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${post.author_id}`);
            }}
          >
            <AvatarImage src={post.author_avatar} />
            <AvatarFallback>{post.author_name?.[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                <ProfileHoverCard userId={post.author_id}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${post.author_id}`);
                    }}
                    className="font-semibold hover:underline text-sm truncate flex items-center"
                  >
                    {post.author_name}
                    <VerificationBadge 
                      isVerified={post.is_verified}
                      verificationType={post.verification_type}
                    />
                  </button>
                </ProfileHoverCard>
                <span className="text-muted-foreground text-sm">·</span>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 hover:bg-blue-500/10 hover:text-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-[18px] w-[18px]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover">
                  {isOwner ? (
                    <>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePinToggle(); }}>
                        {isPinned(post.id) ? (
                          <>
                            <PinOff className="h-4 w-4 mr-2" />
                            Unpin from Profile
                          </>
                        ) : (
                          <>
                            <Pin className="h-4 w-4 mr-2" />
                            Pin to Profile
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowEditDialog(true); }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Post
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Post
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/profile/${post.author_id}`); }}>
                        <UserCircle className="h-4 w-4 mr-2" />
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleFollowToggle(); }}>
                        {isFollowingAuthor ? (
                          <>
                            <UserMinus className="h-4 w-4 mr-2" />
                            Unfollow @{post.author_name}
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Follow @{post.author_name}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMuteUser(); }}>
                        <BellOff className="h-4 w-4 mr-2" />
                        Mute User
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReportPost(); }} className="text-destructive">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Report Post
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleBlockUser(); }} className="text-destructive">
                        <Ban className="h-4 w-4 mr-2" />
                        Block User
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mb-2">
              <PostContent content={post.content} />
              {post.media_url && !Array.isArray((post as any).media_urls) && (
                <>
                  {/* Check if media is video */}
                  {(post.media_url.endsWith('.mp4') || post.media_url.endsWith('.webm') || post.media_url.endsWith('.mov') || post.media_url.includes('/video/')) ? (
                    <div className="mt-3">
                      <VideoViewer videoUrl={post.media_url} />
                    </div>
                  ) : (
                    <div 
                      className="rounded-2xl overflow-hidden mt-3 border border-border cursor-pointer hover:opacity-90 transition"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setGalleryImages([post.media_url!]);
                        setGalleryStartIndex(0);
                        setShowImageGallery(true);
                      }}
                    >
                      <img 
                        src={post.media_url} 
                        alt="Post media"
                        className="w-full h-auto object-cover max-h-96"
                      />
                    </div>
                  )}
                </>
              )}
              {(post as any).media_urls && Array.isArray((post as any).media_urls) && (post as any).media_urls.length > 1 && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-border">
                  <Carousel className="w-full">
                    <CarouselContent>
                      {(post as any).media_urls.map((url: string, index: number) => (
                        <CarouselItem key={index}>
                          <div className="relative aspect-video w-full">
                            <img 
                              src={url} 
                              alt={`Media ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2" />
                    <CarouselNext className="right-2" />
                  </Carousel>
                </div>
              )}
              {(post as any).media_urls && Array.isArray((post as any).media_urls) && (post as any).media_urls.length === 1 && (
                <div 
                  className="rounded-2xl overflow-hidden mt-3 border border-border cursor-pointer hover:opacity-90 transition"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setGalleryImages((post as any).media_urls);
                    setGalleryStartIndex(0);
                    setShowImageGallery(true);
                  }}
                >
                  <img 
                    src={(post as any).media_urls[0]} 
                    alt="Post media"
                    className="w-full h-auto object-cover max-h-96"
                  />
                </div>
              )}
              
              <div className="flex items-center gap-1 mt-3">
                <PostReactionPicker
                  currentReaction={userReaction}
                  onReactionSelect={handleReactionToggle}
                  reactionCounts={reactionCounts}
                />
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 hover:bg-blue-500/10 hover:text-blue-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments(!showComments);
                  }}
                >
                  <MessageCircle className="h-[18px] w-[18px]" />
                  <span className="text-sm">{post.comments_count || ''}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 hover:bg-green-500/10 hover:text-green-500",
                    isReposted(post.id) && "text-green-500"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRepost();
                  }}
                >
                  <Repeat2 className="h-[18px] w-[18px]" />
                  <span className="text-sm">{localRepostCount || ''}</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 hover:bg-blue-500/10 hover:text-blue-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare();
                  }}
                >
                  <Share2 className="h-[18px] w-[18px]" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 hover:bg-yellow-500/10 hover:text-yellow-500",
                    isBookmarked(post.id) && "text-yellow-500"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(post.id);
                  }}
                >
                  <Bookmark className={cn(
                    "h-[18px] w-[18px]",
                    isBookmarked(post.id) && "fill-current"
                  )} />
                </Button>
              </div>

              {showComments && (
                <ThreadedCommentsSection postId={post.id} />
              )}
            </div>
          </div>
        </div>
      </article>

      <SharePostDialog
        postId={post.id}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />

      <ImageGalleryViewer 
        images={galleryImages}
        initialIndex={galleryStartIndex}
        open={showImageGallery}
        onOpenChange={setShowImageGallery}
      />

      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        contentId={post.id}
        contentType="post"
      />
    </>
  );
};
