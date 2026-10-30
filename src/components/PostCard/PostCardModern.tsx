import { haptic } from '@/lib/haptics';
import { profilePathFor } from '@/lib/profilePath';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoreHorizontal, Pencil, Trash2, UserCircle, BellOff, AlertCircle, Ban, Pin, PinOff, MessageCircle, Repeat2, Bookmark, Heart, ExternalLink, Play } from "lucide-react";
import { useState, useEffect, memo } from "react";
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
import { SharePostDialog } from "../SharePostDialog";
import { ImageGalleryViewer } from "../ImageGalleryViewer";
import { VideoViewer } from "../VideoViewer";
import { ReportDialog } from "../ReportDialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { useReactions } from "@/hooks/useReactions";
import { ThreadedCommentsSection } from "../ThreadedCommentsSection";
import { useTopComment } from "@/hooks/useTopComment";
import { VerificationBadge as TopCommentBadge } from "../premium/VerificationBadge";
import { cn } from "@/lib/utils";
import { VerificationBadge } from "../premium/VerificationBadge";
import { ProfileHoverCard } from "../ProfileHoverCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useThumbReorder } from '@/components/composer/ReorderableThumbs';
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { GalleryPickerSheet } from "@/components/showcase/GalleryPickerSheet";
import { useDwellTracker } from "@/hooks/useDwellTracker";
import { extractHashtags, detectPostFormat } from "@/lib/affinityProfile";
import ClickSpark from "@/components/flair/ClickSpark";
import PulseHeart from "@/components/flair/PulseHeart";
import React from 'react';

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

const extractLinkPreview = (content: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = content.match(urlRegex);
  if (match && match[0]) {
    try {
      const url = new URL(match[0]);
      return { url: match[0], domain: url.hostname.replace('www.', ''), title: url.hostname.replace('www.', '').split('.')[0] };
    } catch { return null; }
  }
  return null;
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds}s`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  return format(date, 'MMM d');
};

const textPostThemes = [
  { bg: 'bg-[#1877F2]', text: 'text-white' },       // POST-UPP Blue
  { bg: 'bg-[#28443F]', text: 'text-[#F2FD7D]' },   // Deep Teal
  { bg: 'bg-[#F2FD7D]', text: 'text-[#28443F]' },   // Lemon Yellow
  { bg: 'bg-[#DFE8E6]', text: 'text-[#A0430A]' },   // Sea Mist
  { bg: 'bg-[#614D70]', text: 'text-[#F4F5F3]' },   // Mulled Wine
];

const getThemeForPost = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return textPostThemes[Math.abs(hash) % textPostThemes.length];
};

const PostCardModernComponent = ({ post }: PostCardModernProps) => {
  const { user } = useAuth();
  const { updatePost, deletePost } = usePosts();
  const { toggleBookmark, isBookmarked } = useBookmarks();
  const { following } = useFollowers();
  const { blockUser } = useBlockedUsers();
  const { toggleRepost, isReposted } = useReposts();
  const { pinPost, unpinPost, isPinned } = usePinnedPosts();
  const { userReaction, reactionCounts, toggleReaction: handleReactionToggle, getTotalReactions } = useReactions(post.id);
  const navigate = useNavigate();
  const topComment = useTopComment(post.id, post.comments_count);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [expanded, setExpanded] = useState(false);

  const mediaItems: string[] = (post.media_urls && post.media_urls.length > 0 ? post.media_urls : post.media_url ? [post.media_url] : []) as string[];
  const initialMedia = mediaItems;
  const [editMedia, setEditMedia] = useState<string[]>(initialMedia);
  const [showEditGallery, setShowEditGallery] = useState(false);
  const { getItemProps: getEditThumbProps } = useThumbReorder((from, to) => {
    setEditMedia(prev => { const next = [...prev]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next; });
  });

  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [localReactionCount, setLocalReactionCount] = useState(post.reactions_count);
  const [localRepostCount, setLocalRepostCount] = useState(post.shares_count || 0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [galleryOriginRect, setGalleryOriginRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const captureOriginRect = (target: HTMLElement | null) => {
    const img = target?.querySelector('img') || target;
    if (!img) return setGalleryOriginRect(null);
    const r = img.getBoundingClientRect();
    setGalleryOriginRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  const [showComments, setShowComments] = useState(false);
  const isOwner = user?.id === post.author_id;
  const isPagePost = !!post.page_id;

  const displayName = isPagePost ? (post.page_name || post.author_name) : post.author_name;
  const displayAvatar = isPagePost ? (post.page_avatar || post.author_avatar) : post.author_avatar;
  const displayUsername = isPagePost ? post.page_username : post.author_username;
  const displayVerified = isPagePost ? post.page_is_verified : post.is_verified;
  const linkPreview = extractLinkPreview(post.content || '');

  const isTextOnly = mediaItems.length === 0 && !!post.content;
  const postTheme = getThemeForPost(post.id);

  const dwell = useDwellTracker({ postId: post.id, authorId: post.author_id, hashtags: extractHashtags(post.content || ''), format: detectPostFormat(post) });

  useEffect(() => { setLocalReactionCount(getTotalReactions()); }, [reactionCounts]);

  const handleDelete = async () => { await deletePost(post.id); setShowDeleteDialog(false); toast({ title: "Post deleted" }); };
  const handleRepost = async () => {
    if (!user) return;
    const wasReposted = isReposted(post.id);
    setLocalRepostCount(prev => wasReposted ? Math.max(0, prev - 1) : prev + 1);
    try { await toggleRepost(post.id); } catch (error) { setLocalRepostCount(post.shares_count || 0); }
  };
  const handleLikeWithAnimation = async () => { haptic('light'); dwell.reportReaction('like'); await handleReactionToggle('like'); };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[role="button"]') || target.closest('[role="menu"]') || target.closest('video')) return;
    if (document.querySelector('[data-radix-popper-content-wrapper] [data-state="open"], [data-state="open"][role="dialog"]')) return;
    navigate(`/post/${post.id}`);
  };

  const renderContent = (text: string) => {
    if (!text) return null;
    let displayText = text;
    if (linkPreview) displayText = text.replace(linkPreview.url, '').trim();
    const parts = displayText.split(/(@\w+|#\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) return <button key={index} onClick={e => e.stopPropagation()} className="text-primary hover:underline font-medium">{part}</button>;
      if (part.startsWith('#')) return <button key={index} onClick={e => { e.stopPropagation(); navigate(`/hashtag/${part.slice(1)}`); }} className="text-primary hover:underline font-medium">{part}</button>;
      return <span key={index}>{part}</span>;
    });
  };

  const getAvatarFallback = () => displayName?.charAt(0).toUpperCase() || 'U';
  const handleAuthorClick = (e: React.MouseEvent) => { e.stopPropagation(); if (isPagePost && post.page_username) navigate(`/page/${post.page_username}`); else navigate(profilePathFor(post.author_id, post.author_username)); };

  return <TooltipProvider>
    <>
      <Card ref={dwell.targetRef} className={cn("post-card bg-card rounded-xl border border-border/50 cursor-pointer overflow-hidden shadow-sm", post.is_pinned && "ring-2 ring-primary/20")} onClick={handleCardClick}>

        {post.is_pinned && <div className="px-4 pt-2 flex items-center gap-2 text-muted-foreground text-xs"><Pin className="h-3 w-3" /><span>Pinned post</span></div>}

        {/* Post Header */}
        <div className="flex items-start gap-3 px-4 py-3">
          <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-border flex-shrink-0" onClick={handleAuthorClick}>
            <AvatarImage src={displayAvatar} /><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{getAvatarFallback()}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <button onClick={handleAuthorClick} className="font-semibold text-foreground hover:underline text-[15px] flex items-center gap-1">
              {displayName}{displayVerified && <VerificationBadge isVerified={true} />}
            </button>
            {displayUsername && <div className="text-muted-foreground text-xs">@{displayUsername}</div>}
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-0.5">
              <span className="hover:underline cursor-default">{formatRelativeTime(post.created_at)}</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-muted" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-5 w-5 text-muted-foreground" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isOwner ? <>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); setShowEditDialog(true); }}><Pencil className="h-4 w-4 mr-2" />Edit Post</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={e => { e.stopPropagation(); setShowDeleteDialog(true); }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete Post</DropdownMenuItem>
              </> : <>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(profilePathFor(post.author_id, post.author_username)); }}><UserCircle className="h-4 w-4 mr-2" />View Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); toggleBookmark(post.id); }}><Bookmark className="h-4 w-4 mr-2" />Save Post</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={e => e.stopPropagation()}><BellOff className="h-4 w-4 mr-2" />Mute User</DropdownMenuItem>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); setShowReportDialog(true); }} className="text-destructive"><AlertCircle className="h-4 w-4 mr-2" />Report Post</DropdownMenuItem>
                <DropdownMenuItem onClick={e => e.stopPropagation()} className="text-destructive"><Ban className="h-4 w-4 mr-2" />Block User</DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Caption FIRST */}
        {post.content && (
          <div className="px-4 pb-2">
            {isTextOnly ? (
              <div className={cn("rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[160px]", postTheme.bg, postTheme.text)}>
                <p className="text-lg font-semibold leading-relaxed whitespace-pre-wrap">{post.content}</p>
              </div>
            ) : (
              <div className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">
                <p className={cn(!expanded && "line-clamp-3")}>{renderContent(post.content)}</p>
                {post.content.length > 100 && (
                  <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="text-muted-foreground text-sm font-semibold mt-1">
                    {expanded ? 'See less' : 'See more'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mx-4 border-b border-border/50" />

        {/* Media - Edge to Edge */}
        {mediaItems.length === 1 && (
          <div className="w-full mt-2">
            {isVideoUrl(mediaItems[0]) ? (
              <VideoViewer videoUrl={mediaItems[0]} playOnFocus objectFit="cover" />
            ) : (
              <div className="cursor-pointer" onClick={e => { e.stopPropagation(); captureOriginRect(e.currentTarget as HTMLElement); setGalleryImages(mediaItems); setGalleryStartIndex(0); setShowImageGallery(true); }}>
                <img src={mediaItems[0]} alt="Post media" className="w-full h-auto max-h-[500px] object-cover" loading="lazy" />
              </div>
            )}
          </div>
        )}

        {mediaItems.length > 1 && (
          <div data-no-app-swipe className="w-full mt-2" onClick={e => e.stopPropagation()}>
            <Carousel className="w-full">
              <CarouselContent>
                {mediaItems.map((url, i) => (
                  <CarouselItem key={url + i} className="p-0">
                    {isVideoUrl(url) ? (
                      <div className="relative w-full h-[300px] sm:h-[400px] bg-black flex items-center justify-center"><VideoViewer videoUrl={url} playOnFocus objectFit="cover" /></div>
                    ) : (
                      <div className="relative w-full h-[300px] sm:h-[400px] bg-black flex items-center justify-center cursor-pointer" onClick={e => { captureOriginRect(e.currentTarget as HTMLElement); setGalleryImages(mediaItems.filter(m => !isVideoUrl(m))); setGalleryStartIndex(i); setShowImageGallery(true); }}>
                        <img src={url} alt={`Media ${i + 1}`} className="relative z-10 max-h-full max-w-full object-contain" loading="lazy" />
                        <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-medium pointer-events-none">{i + 1} / {mediaItems.length}</div>
                      </div>
                    )}
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2 z-30" /><CarouselNext className="right-2 z-30" />
            </Carousel>
          </div>
        )}

        <div className="mx-4 border-b border-border/50 mt-2" />

        {/* Action Bar with Counters */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <ClickSpark sparkColor="#ff4d6d" shape="dot" sparkCount={7} sparkSize={9} sparkRadius={22} duration={420}>
              <div className="flex h-9 items-center gap-1.5 rounded-lg hover:bg-destructive/10 px-2 transition-all">
                <PulseHeart liked={userReaction === 'like'} count={localReactionCount} showCount={false} icon="heart" size={24} corner={10} likedColor="hsl(var(--destructive))" idleColor="hsl(var(--foreground))" pillColor="transparent" textColor="hsl(var(--foreground))" onChange={handleLikeWithAnimation} />
                <span className="text-sm font-medium">{localReactionCount > 0 ? localReactionCount : ''}</span>
              </div>
            </ClickSpark>

            <button className="flex h-9 items-center gap-1.5 rounded-lg hover:bg-muted px-2 transition-all" onClick={e => { e.stopPropagation(); setShowComments(true); }}>
              <MessageCircle className="h-6 w-6 text-foreground" />
              <span className="text-sm font-medium">{post.comments_count > 0 ? post.comments_count : ''}</span>
            </button>

            <button className={cn("flex h-9 items-center gap-1.5 rounded-lg hover:bg-muted px-2 transition-all", isReposted(post.id) && "text-success")} onClick={e => { e.stopPropagation(); handleRepost(); }}>
              <Repeat2 className={cn("h-6 w-6", isReposted(post.id) ? "text-success" : "text-foreground")} />
              <span className="text-sm font-medium">{localRepostCount > 0 ? localRepostCount : ''}</span>
            </button>
          </div>

          <button className={cn("h-9 px-2 rounded-lg hover:bg-muted transition-all", isBookmarked(post.id) && "text-warning")} onClick={e => { e.stopPropagation(); toggleBookmark(post.id); }}>
            <Bookmark className={cn("h-6 w-6", isBookmarked(post.id) ? "fill-current text-warning" : "text-foreground")} />
          </button>
        </div>

        {/* Hashtags & Tags footer */}
        {linkPreview && (
          <div className="px-4 pb-3" onClick={e => e.stopPropagation()}>
            <a href={linkPreview.url} target="_blank" rel="noopener noreferrer" className="block border border-border rounded-xl overflow-hidden hover:bg-muted/50 transition-colors">
              <div className="p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><ExternalLink className="h-5 w-5 text-muted-foreground" /></div>
                <div className="min-w-0"><p className="font-medium text-sm truncate">{linkPreview.title}</p><p className="text-xs text-muted-foreground truncate">{linkPreview.domain}</p></div>
              </div>
            </a>
          </div>
        )}

        {/* Top Comment */}
        {topComment && !showComments && (
          <div className="flex items-start gap-2 px-4 pb-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowComments(true); }}>
            <Avatar className="h-6 w-6 flex-shrink-0"><AvatarImage src={topComment.user?.avatar_url} /><AvatarFallback className="text-[10px]">{topComment.user?.display_name?.[0] || 'U'}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1"><span className="font-semibold text-xs">{topComment.user?.display_name}</span><TopCommentBadge isVerified={topComment.user?.is_verified} verificationType={topComment.user?.verification_type} /></div>
              <p className="text-xs text-foreground/80 line-clamp-1">{topComment.content}</p>
            </div>
          </div>
        )}
      </Card>

      <SharePostDialog postId={post.id} open={showShareDialog} onOpenChange={setShowShareDialog} />
      <ImageGalleryViewer images={galleryImages} initialIndex={galleryStartIndex} open={showImageGallery} onOpenChange={setShowImageGallery} originRect={galleryOriginRect} />
      <ReportDialog open={showReportDialog} onOpenChange={setShowReportDialog} contentId={post.id} contentType="post" />

      <Sheet open={showComments} onOpenChange={setShowComments}>
        <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col rounded-t-2xl" onClick={e => e.stopPropagation()}>
          <SheetHeader className="px-4 py-3 border-b"><SheetTitle>Comments</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4"><ThreadedCommentsSection postId={post.id} /></div>
        </SheetContent>
      </Sheet>
    </>
  </TooltipProvider>;
};

export const PostCardModern = memo(PostCardModernComponent, (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.reactions_count === nextProps.post.reactions_count &&
    prevProps.post.comments_count === nextProps.post.comments_count &&
    prevProps.post.shares_count === nextProps.post.shares_count &&
    prevProps.post.content === nextProps.post.content &&
    prevProps.post.is_pinned === nextProps.post.is_pinned &&
    prevProps.post.media_urls?.length === nextProps.post.media_urls?.length &&
    prevProps.post.media_url === nextProps.post.media_url
  );
});