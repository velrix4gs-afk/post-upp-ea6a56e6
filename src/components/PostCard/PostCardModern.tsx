import { haptic } from '@/lib/haptics';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoreHorizontal, Pencil, Trash2, UserPlus, UserMinus, BellOff, AlertCircle, Ban, UserCircle, Pin, PinOff, MessageCircle, Repeat2, Share2, Bookmark, Heart, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePosts } from "@/hooks/usePosts";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useFollowers } from "@/hooks/useFollowers";
import { useBlockedUsers } from "@/hooks/useBlockedUsers";
import { useReposts } from "@/hooks/useReposts";
import { usePinnedPosts } from "@/hooks/usePinnedPosts";
import { formatDistanceToNow, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { CommentsSection } from "../CommentsSection";
import { SharePostDialog } from "../SharePostDialog";
import { ImageGalleryViewer } from "../ImageGalleryViewer";
import { VideoViewer } from "../VideoViewer";
import { ReportDialog } from "../ReportDialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { PostReactionPicker } from "../PostReactionPicker";
import { useReactions } from "@/hooks/useReactions";
import { ThreadedCommentsSection } from "../ThreadedCommentsSection";
import { useTopComment } from "@/hooks/useTopComment";
import { VerificationBadge as TopCommentBadge } from "../premium/VerificationBadge";
import { cn } from "@/lib/utils";
import { VerificationBadge } from "../premium/VerificationBadge";
import { ProfileHoverCard } from "../ProfileHoverCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useThumbReorder } from '@/components/composer/ReorderableThumbs';
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
export interface PostCardModernProps {
  post: {
    id: string;
    content: string;
    media_url?: string;
    media_urls?: string[] | null;
    created_at: string;
    reactions_count: number;
    comments_count: number;
    shares_count?: number;
    author_name: string;
    author_username?: string;
    author_avatar?: string;
    author_id: string;
    is_verified?: boolean;
    verification_type?: string | null;
    verified_at?: string | null;
    is_pinned?: boolean;
    page_id?: string;
    page_name?: string;
    page_username?: string;
    page_avatar?: string;
    page_is_verified?: boolean;
  };
}

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || url.includes('/video/');

// Utility to extract link preview from content
const extractLinkPreview = (content: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = content.match(urlRegex);
  if (match && match[0]) {
    try {
      const url = new URL(match[0]);
      return {
        url: match[0],
        domain: url.hostname.replace('www.', ''),
        title: url.hostname.replace('www.', '').split('.')[0].charAt(0).toUpperCase() + url.hostname.replace('www.', '').split('.')[0].slice(1)
      };
    } catch {
      return null;
    }
  }
  return null;
};

// Format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds}s`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w`;
  return format(date, 'MMM d');
};
export const PostCardModern = ({
  post
}: PostCardModernProps) => {
  const {
    user
  } = useAuth();
  const {
    updatePost,
    deletePost
  } = usePosts();
  const {
    toggleBookmark,
    isBookmarked
  } = useBookmarks();
  const {
    followUser,
    unfollowUser,
    following
  } = useFollowers();
  const {
    blockUser
  } = useBlockedUsers();
  const {
    toggleRepost,
    isReposted
  } = useReposts();
  const {
    pinPost,
    unpinPost,
    isPinned
  } = usePinnedPosts();
  const {
    userReaction,
    reactionCounts,
    toggleReaction: handleReactionToggle,
    getTotalReactions
  } = useReactions(post.id);
  const navigate = useNavigate();
  const topComment = useTopComment(post.id, post.comments_count);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const mediaItems: string[] = (post.media_urls && post.media_urls.length > 0 ? post.media_urls : post.media_url ? [post.media_url] : []) as string[];
  const initialMedia = mediaItems;
  const [editMedia, setEditMedia] = useState<string[]>(initialMedia);
  const { getItemProps: getEditThumbProps } = useThumbReorder((from, to) => {
    setEditMedia(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  });
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [localReactionCount, setLocalReactionCount] = useState(post.reactions_count);
  const [localRepostCount, setLocalRepostCount] = useState(post.shares_count || 0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const isOwner = user?.id === post.author_id;
  const isFollowingAuthor = following.some(f => f.following?.id === post.author_id);
  const isPagePost = !!post.page_id;
  const displayName = isPagePost ? (post.page_name || post.author_name) : post.author_name;
  const displayAvatar = isPagePost ? (post.page_avatar || post.author_avatar) : post.author_avatar;
  const displayUsername = isPagePost ? post.page_username : post.author_username;
  const displayVerified = isPagePost ? post.page_is_verified : post.is_verified;
  const linkPreview = extractLinkPreview(post.content || '');
  const handleFollowToggle = async () => {
    if (isFollowingAuthor) {
      await unfollowUser(post.author_id);
      toast({
        title: 'Unfollowed'
      });
    } else {
      await followUser(post.author_id, false);
      toast({
        title: 'Following'
      });
    }
  };
  const handleMuteUser = () => {
    toast({
      title: 'Mute feature coming soon'
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
      title: 'User Blocked'
    });
  };
  useEffect(() => {
    setLocalReactionCount(getTotalReactions());
  }, [reactionCounts]);
  const handleEdit = async () => {
    if (!editContent.trim() && editMedia.length === 0) return;
    await updatePost(post.id, {
      content: editContent,
      media_url: editMedia[0] || null,
      media_urls: editMedia.length > 0 ? editMedia : null,
      media_type: editMedia.length > 1 ? 'multiple' : editMedia.length === 1 ? 'image' : null
    } as any);
    setShowEditDialog(false);
    toast({
      title: "Post updated"
    });
  };

  const handleEditMediaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploadingMedia(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from('posts').upload(path, file, {
          contentType: file.type,
          upsert: false
        });
        if (error) throw error;
        const { data } = supabase.storage.from('posts').getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      setEditMedia(prev => [...prev, ...uploaded]);
    } catch (e) {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploadingMedia(false);
    }
  };
  const handleDelete = async () => {
    await deletePost(post.id);
    setShowDeleteDialog(false);
    toast({
      title: "Post deleted"
    });
  };
  const handleRepost = async () => {
    if (!user) return;
    const wasReposted = isReposted(post.id);
    setLocalRepostCount(prev => wasReposted ? Math.max(0, prev - 1) : prev + 1);
    try {
      await toggleRepost(post.id);
    } catch (error) {
      setLocalRepostCount(post.shares_count || 0);
    }
  };
  const handleLikeWithAnimation = async () => {
    haptic('light');
    setIsLikeAnimating(true);
    await handleReactionToggle('like');
    setTimeout(() => setIsLikeAnimating(false), 300);
  };
  const handleShare = () => {
    setShowShareDialog(true);
  };
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[role="button"]') ||
      target.closest('[role="menu"]') ||
      target.closest('[role="dialog"]') ||
      target.closest('[data-radix-popper-content-wrapper]') ||
      target.closest('video') ||
      target.closest('audio') ||
      target.closest('[data-media]')
    ) {
      return;
    }
    // Guard: if any Radix overlay (popover/dropdown/dialog) is currently open,
    // this click is the outside-dismiss for that overlay — do NOT also navigate.
    if (document.querySelector('[data-radix-popper-content-wrapper] [data-state="open"], [data-state="open"][role="dialog"]')) {
      return;
    }
    navigate(`/post/${post.id}`);
  };

  // Parse content for @mentions and #hashtags
  const renderContent = (text: string) => {
    if (!text) return null;

    // Remove URL if we're showing link preview
    let displayText = text;
    if (linkPreview) {
      displayText = text.replace(linkPreview.url, '').trim();
    }
    const parts = displayText.split(/(@\w+|#\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return <button key={index} onClick={e => {
          e.stopPropagation();
          // Navigate to user profile
        }} className="text-primary hover:underline font-medium">
            {part}
          </button>;
      }
      if (part.startsWith('#')) {
        const tag = part.slice(1);
        return <button key={index} onClick={e => {
          e.stopPropagation();
          navigate(`/hashtag/${tag}`);
        }} className="text-primary hover:underline font-medium">
            {part}
          </button>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Get initials for avatar fallback with color
  const getAvatarFallback = () => {
    const name = displayName || 'U';
    return name.charAt(0).toUpperCase();
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPagePost && post.page_username) {
      navigate(`/page/${post.page_username}`);
    } else {
      navigate(`/profile/${post.author_id}`);
    }
  };
  return <TooltipProvider>
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
              <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
            </DialogHeader>
            <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[100px]" />
            {editMedia.length > 0 && <div className="grid grid-cols-3 gap-2">
                {editMedia.map((url, i) => {
                  const { className: dragClass, ...dragProps } = getEditThumbProps(i);
                  return <div key={url + i} {...dragProps} className={cn("relative rounded-lg overflow-hidden bg-muted aspect-square touch-none", dragClass)}>
                    <img src={url} alt="Post media" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 text-[10px] text-foreground">{i + 1}</span>
                    <button
                      type="button"
                      onClick={() => setEditMedia(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 text-foreground flex items-center justify-center text-xs"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>;
                })}
              </div>}
            {editMedia.length > 1 && <p className="text-[11px] text-muted-foreground">Hold and drag a photo to change its order</p>}
            <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer">
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleEditMediaUpload(e.target.files)} />
              {uploadingMedia ? 'Uploading…' : 'Add / change photos'}
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={handleEdit} className="bg-primary" disabled={uploadingMedia}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card data-feed-card className={cn("post-card fb-feed-card post-card-float press-elastic surface-rim settle-in bg-card rounded-xl border-0 cursor-pointer overflow-hidden", post.is_pinned && "ring-2 ring-primary/20")} onClick={handleCardClick}>
          {/* Pinned indicator */}
          {post.is_pinned && <div className="px-4 pt-2 flex items-center gap-2 text-muted-foreground text-xs">
              <Pin className="h-3 w-3" />
              <span>Pinned post</span>
            </div>}

          <div className="p-4">
            {/* Post Header */}
            <div className="flex items-start gap-3 mb-3">
              {isPagePost ? (
                <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-border flex-shrink-0" onClick={handleAuthorClick}>
                  <AvatarImage src={displayAvatar} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {getAvatarFallback()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <ProfileHoverCard userId={post.author_id}>
                  <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-border flex-shrink-0" onClick={handleAuthorClick}>
                    <AvatarImage src={displayAvatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                      {getAvatarFallback()}
                    </AvatarFallback>
                  </Avatar>
                </ProfileHoverCard>
              )}

              <div className="flex-1 min-w-0">
                {isPagePost ? (
                  <button onClick={handleAuthorClick} className="font-semibold text-foreground hover:underline text-[15px] flex items-center gap-1">
                    {displayName}
                    {displayVerified && <VerificationBadge isVerified={true} />}
                  </button>
                ) : (
                  <ProfileHoverCard userId={post.author_id}>
                    <button onClick={handleAuthorClick} className="font-semibold text-foreground hover:underline text-[15px] flex items-center gap-1">
                      {displayName}
                      <VerificationBadge isVerified={post.is_verified} verificationType={post.verification_type} />
                    </button>
                  </ProfileHoverCard>
                )}
                
                {displayUsername && <div className="text-muted-foreground text-sm">@{displayUsername}</div>}
                {isPagePost && <div className="text-muted-foreground text-xs">Published by {post.author_name}</div>}
                
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="hover:underline cursor-default">
                        {formatRelativeTime(post.created_at)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{format(new Date(post.created_at), 'MMMM d, yyyy \'at\' h:mm a')}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Follow button - only show if not following and not the owner */}
              {!isOwner && user && !isFollowingAuthor && <Button variant="default" size="sm" className="h-8 px-4 rounded-full text-xs font-semibold bg-primary hover:bg-primary/90" onClick={e => {
              e.stopPropagation();
              handleFollowToggle();
            }}>
                  Follow
                </Button>}

              {/* More options menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-muted" onClick={e => e.stopPropagation()}>
                    <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {isOwner ? <>
                      <DropdownMenuItem onClick={e => {
                    e.stopPropagation();
                    handlePinToggle();
                  }}>
                        {isPinned(post.id) ? <><PinOff className="h-4 w-4 mr-2" />Unpin from Profile</> : <><Pin className="h-4 w-4 mr-2" />Pin to Profile</>}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={e => {
                    e.stopPropagation();
                    setShowEditDialog(true);
                  }}>
                        <Pencil className="h-4 w-4 mr-2" />Edit Post
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />Delete Post
                      </DropdownMenuItem>
                    </> : <>
                      <DropdownMenuItem onClick={e => {
                    e.stopPropagation();
                    navigate(`/profile/${post.author_id}`);
                  }}>
                        <UserCircle className="h-4 w-4 mr-2" />View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => {
                    e.stopPropagation();
                    toggleBookmark(post.id);
                  }}>
                        <Bookmark className="h-4 w-4 mr-2" />Save Post
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={e => {
                    e.stopPropagation();
                    handleMuteUser();
                  }}>
                        <BellOff className="h-4 w-4 mr-2" />Mute User
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => {
                    e.stopPropagation();
                    handleReportPost();
                  }} className="text-destructive">
                        <AlertCircle className="h-4 w-4 mr-2" />Report Post
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => {
                    e.stopPropagation();
                    handleBlockUser();
                  }} className="text-destructive">
                        <Ban className="h-4 w-4 mr-2" />Block User
                      </DropdownMenuItem>
                    </>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Post Content */}
            <div className="mb-3">
              <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">
                {renderContent(post.content)}
              </p>
            </div>

            {/* Link Preview */}
            {linkPreview && <a href={linkPreview.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="block mb-3 border border-border rounded-xl overflow-hidden hover:bg-muted/50 transition-colors">
                <div className="p-3 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{linkPreview.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{linkPreview.domain}</p>
                  </div>
                </div>
              </a>}

            {/* Media */}
            {mediaItems.length === 1 && <>
                {isVideoUrl(mediaItems[0]) ? <div className="post-media rounded-xl overflow-hidden mb-3">
                    <VideoViewer videoUrl={mediaItems[0]} />
                  </div> : <div className="post-media rounded-xl overflow-hidden mb-3 cursor-pointer hover:opacity-95 transition bg-black" onClick={e => {
              e.stopPropagation();
              setGalleryImages(mediaItems);
              setGalleryStartIndex(0);
              setShowImageGallery(true);
            }}>
                    <img src={mediaItems[0]} alt="Post media" className="w-full h-auto object-contain" loading="lazy" />
                  </div>}
              </>}

            {mediaItems.length > 1 && <div className="post-media rounded-xl overflow-hidden mb-3" onClick={e => e.stopPropagation()}>
                <Carousel className="w-full">
                  <CarouselContent>
                    {mediaItems.map((url, i) => <CarouselItem key={url + i}>
                        {isVideoUrl(url) ? <VideoViewer videoUrl={url} /> : <div className="bg-black cursor-pointer" onClick={() => {
                    setGalleryImages(mediaItems.filter(m => !isVideoUrl(m)));
                    setGalleryStartIndex(i);
                    setShowImageGallery(true);
                  }}>
                            <img src={url} alt={`Post media ${i + 1}`} className="w-full h-auto object-contain" loading="lazy" />
                          </div>}
                      </CarouselItem>)}
                  </CarouselContent>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </Carousel>
                <div className="mt-1 text-center text-xs text-muted-foreground">{mediaItems.length} photos</div>
              </div>}

            {/* Engagement Stats */}
            {(localReactionCount > 0 || post.comments_count > 0 || localRepostCount > 0) && <div className="flex items-center justify-between py-2 border-b border-border text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  {localReactionCount > 0 && <span className="flex items-center gap-1.5">
                      <span className="flex -space-x-1">
                        <span className="h-4 w-4 rounded-full bg-destructive flex items-center justify-center">
                          <Heart className="h-2.5 w-2.5 text-white fill-white" />
                        </span>
                      </span>
                      <span className="font-medium">{localReactionCount}</span>
                    </span>}
                </div>
                <div className="flex items-center gap-3">
                  {post.comments_count > 0 && <button onClick={e => {
                e.stopPropagation();
                setShowComments(!showComments);
              }} className="hover:underline">
                      {post.comments_count} comment{post.comments_count !== 1 ? 's' : ''}
                    </button>}
                  {localRepostCount > 0 && <span>{localRepostCount} share{localRepostCount !== 1 ? 's' : ''}</span>}
                </div>
              </div>}

            {/* Top Comment Preview */}
            {topComment && !showComments && (
              <div 
                className="flex items-start gap-2 py-2 cursor-pointer hover:bg-muted/50 rounded-lg px-1 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowComments(true);
                }}
              >
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={topComment.user?.avatar_url} />
                  <AvatarFallback className="text-[10px]">
                    {topComment.user?.display_name?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-xs text-foreground">
                      {topComment.user?.display_name}
                    </span>
                    <TopCommentBadge 
                      isVerified={topComment.user?.is_verified}
                      verificationType={topComment.user?.verification_type}
                    />
                    {topComment.likes_count > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-0.5">
                        <Heart className="h-2.5 w-2.5 fill-current text-destructive" />
                        {topComment.likes_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2">{topComment.content}</p>
                </div>
              </div>
            )}

            {post.comments_count > 1 && !showComments && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors pb-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowComments(true);
                }}
              >
                View all {post.comments_count} comments
              </button>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-1 -mx-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn("flex-1 gap-2 h-10 rounded-lg hover:bg-destructive/10 transition-all", userReaction && "text-destructive", isLikeAnimating && "scale-110")} onClick={e => {
                  e.stopPropagation();
                  handleLikeWithAnimation();
                }}>
                    <Heart className={cn("h-5 w-5 transition-all", userReaction && "fill-current")} />
                    <span className="text-sm font-medium">Like</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Like this post</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex-1 gap-2 h-10 rounded-lg hover:bg-primary/10" onClick={e => {
                  e.stopPropagation();
                  setShowComments(!showComments);
                }}>
                    <MessageCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Comment</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Comment on this post</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn("flex-1 gap-2 h-10 rounded-lg hover:bg-success/10", isReposted(post.id) && "text-success")} onClick={e => {
                  e.stopPropagation();
                  handleRepost();
                }}>
                    <Repeat2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Share</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share this post</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className={cn("flex-1 gap-2 h-10 rounded-lg hover:bg-warning/10", isBookmarked(post.id) && "text-warning")} onClick={e => {
                  e.stopPropagation();
                  toggleBookmark(post.id);
                }}>
                    <Bookmark className={cn("h-5 w-5", isBookmarked(post.id) && "fill-current")} />
                    <span className="text-sm font-medium">Save</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save this post</TooltipContent>
              </Tooltip>
            </div>

            {/* Comments Section */}
            {/* Comments now open in a bottom-sheet popup (see below) */}
          </div>
        </Card>

        <SharePostDialog postId={post.id} open={showShareDialog} onOpenChange={setShowShareDialog} />

        <ImageGalleryViewer images={galleryImages} initialIndex={galleryStartIndex} open={showImageGallery} onOpenChange={setShowImageGallery} />

        <ReportDialog open={showReportDialog} onOpenChange={setShowReportDialog} contentId={post.id} contentType="post" />

        <Sheet open={showComments} onOpenChange={setShowComments}>
          <SheetContent
            side="bottom"
            className="h-[85vh] max-h-[85vh] p-0 flex flex-col rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <SheetHeader className="px-4 py-3 border-b border-border">
              <SheetTitle className="text-base">Comments</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
              <ThreadedCommentsSection postId={post.id} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    </TooltipProvider>;
};