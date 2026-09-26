import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import {
  Plus, Heart, MessageCircle, Share2, Bookmark, Pause, Play,
  Volume2, VolumeX, Film, Loader2, Send, MoreHorizontal,
  UserPlus, Eye, Pin, Reply, Trash2, Flag, X
} from 'lucide-react';
import { useReels, Reel, ReelComment } from '@/hooks/useReels';
import { useAuth } from '@/hooks/useAuth';
import { useFollowers } from '@/hooks/useFollowers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { VerificationBadge } from '@/components/premium/VerificationBadge';
import { InstagramReelCreator } from '@/components/InstagramReelCreator';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ReportUserDialog } from '@/components/messaging/ReportUserDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CommentWithReplies extends ReelComment {
  replies?: ReelComment[];
  likes_count?: number;
  is_liked?: boolean;
  is_pinned?: boolean;
}

const ReelsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    reels,
    loading,
    hasMore,
    savedReelIds,
    fetchReels,
    viewReel,
    likeReel,
    toggleSaveReel,
    fetchComments,
    addComment,
    deleteReel,
  } = useReels();
  const {
    following,
    pendingFollowing,
    loading: followingUsersLoading,
    followUser,
    unfollowUser,
  } = useFollowers();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const [likeAnimations, setLikeAnimations] = useState<{ [key: string]: boolean }>({});
  const [loadingComment, setLoadingComment] = useState(false);
  const [videoProgress, setVideoProgress] = useState<{ [key: string]: number }>({});
  const [likingReels, setLikingReels] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [pinnedComments, setPinnedComments] = useState<Set<string>>(new Set());
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [commentLikes, setCommentLikes] = useState<{ [key: string]: number }>({});
  const [showReplies, setShowReplies] = useState<Set<string>>(new Set());
  const [followingReels, setFollowingReels] = useState<Reel[]>([]);
  const [followingFeedLoading, setFollowingFeedLoading] = useState(false);
  const [followingHasMore, setFollowingHasMore] = useState(false);
  const [followActions, setFollowActions] = useState<Set<string>>(new Set());
  const [reportingUser, setReportingUser] = useState<Reel | null>(null);

  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const viewTimers = useRef<{ [key: string]: number }>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const followingFeedLock = useRef(false);
  const followingFeedOffset = useRef(0);
  const commentActionLocks = useRef(new Set<string>());
  const pinnedCommentLock = useRef(false);
  const followingIds = useMemo(
    () => new Set(following.map((entry) => entry.following_id)),
    [following],
  );
  const pendingFollowingIds = useMemo(
    () => new Set(pendingFollowing.map((entry) => entry.following_id)),
    [pendingFollowing],
  );
  const followingKey = useMemo(
    () => [...followingIds].sort().join(','),
    [followingIds],
  );
  const visibleReels = activeTab === 'following' ? followingReels : reels;
  const visibleLoading = activeTab === 'following' ? followingFeedLoading || followingUsersLoading : loading;
  const visibleHasMore = activeTab === 'following' ? followingHasMore : hasMore;

  const fetchFollowingReels = useCallback(async (reset = false) => {
    if (!user || followingFeedLock.current || followingIds.size === 0) return;
    followingFeedLock.current = true;
    setFollowingFeedLoading(true);
    if (reset) {
      setFollowingReels([]);
      followingFeedOffset.current = 0;
    }
    const start = followingFeedOffset.current;
    try {
      const { data, error } = await supabase
        .from('reels')
        .select(`
          id, user_id, video_url, thumbnail_url, caption, duration,
          views_count, likes_count, comments_count, shares_count, created_at,
          creator:profiles!reels_user_id_fkey(display_name, avatar_url, is_verified)
        `)
        .in('user_id', [...followingIds])
        .order('created_at', { ascending: false })
        .range(start, start + 19);
      if (error) throw error;

      const reelIds = (data || []).map((reel) => reel.id);
      const { data: likedRows, error: likedError } = reelIds.length
        ? await supabase.from('reel_reactions').select('reel_id').eq('user_id', user.id).in('reel_id', reelIds)
        : { data: [], error: null };
      if (likedError) throw likedError;

      const likedIds = new Set((likedRows || []).map((row) => row.reel_id));
      const nextReels: Reel[] = (data || []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        video_url: row.video_url,
        thumbnail_url: row.thumbnail_url || undefined,
        caption: row.caption || undefined,
        duration: row.duration || undefined,
        views_count: row.views_count || 0,
        likes_count: row.likes_count || 0,
        comments_count: row.comments_count || 0,
        shares_count: row.shares_count || 0,
        created_at: row.created_at || new Date().toISOString(),
        creator_name: row.creator?.display_name || 'User',
        creator_avatar: row.creator?.avatar_url || undefined,
        is_verified: row.creator?.is_verified || false,
        is_liked: likedIds.has(row.id),
      }));
      setFollowingReels((previous) => reset ? nextReels : [...previous, ...nextReels]);
      followingFeedOffset.current = start + nextReels.length;
      setFollowingHasMore(nextReels.length === 20);
    } catch (error) {
      console.error('Failed to load following reels:', error);
      toast({ title: 'Could not load reels from followed creators', variant: 'destructive' });
      if (reset) setFollowingReels([]);
      setFollowingHasMore(false);
    } finally {
      followingFeedLock.current = false;
      setFollowingFeedLoading(false);
    }
  }, [followingIds, user]);

  useEffect(() => {
    if (activeTab !== 'following' || followingUsersLoading) return;
    if (followingIds.size === 0) {
      setFollowingReels([]);
      setFollowingHasMore(false);
      return;
    }
    setCurrentIndex(0);
    containerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    void fetchFollowingReels(true);
  }, [activeTab, followingKey, followingUsersLoading, followingIds.size, fetchFollowingReels]);

  const selectTab = (tab: 'forYou' | 'following') => {
    setActiveTab(tab);
    setCurrentIndex(0);
    containerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Setup Intersection Observer for auto-play
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
            video.play().catch(() => { });
            setIsPlaying(true);
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.7 }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Observe videos and attach timeupdate listeners
  useEffect(() => {
    const videosToObserve: HTMLVideoElement[] = [];

    Object.entries(videoRefs.current).forEach(([indexStr, video]) => {
      if (video && observerRef.current) {
        observerRef.current.observe(video);
        videosToObserve.push(video);

        const handleTimeUpdate = () => {
          if (video.duration) {
            const progress = (video.currentTime / video.duration) * 100;
            const reelId = visibleReels[parseInt(indexStr)]?.id;
            if (reelId) {
              setVideoProgress(prev => ({ ...prev, [reelId]: progress }));
            }
          }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
      }
    });

    return () => {
      // Only unobserve the videos we observed, don't disconnect the whole observer
      videosToObserve.forEach(video => {
        observerRef.current?.unobserve(video);
      });
    };
  }, [visibleReels]);

  // Track views
  useEffect(() => {
    const reel = visibleReels[currentIndex];
    if (reel) {
      startViewTracking(reel.id);
    }

    return () => {
      Object.values(viewTimers.current).forEach(clearTimeout);
    };
  }, [currentIndex, visibleReels]);

  const startViewTracking = (reelId: string) => {
    if (!reelId || viewTimers.current[reelId]) return;

    const startTime = Date.now();
    viewTimers.current[reelId] = window.setTimeout(() => {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      viewReel(reelId, duration, true);
      delete viewTimers.current[reelId];
    }, 3000);
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    if (!itemHeight) return;
    const newIndex = Math.round(scrollTop / itemHeight);

    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < visibleReels.length) {
      setCurrentIndex(newIndex);

      if (newIndex >= visibleReels.length - 2 && visibleHasMore && !visibleLoading) {
        if (activeTab === 'following') void fetchFollowingReels();
        else void fetchReels();
      }
    }
  }, [activeTab, currentIndex, fetchFollowingReels, fetchReels, visibleHasMore, visibleLoading, visibleReels.length]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRefs.current[currentIndex];
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    Object.values(videoRefs.current).forEach((video) => {
      if (video) video.muted = !isMuted;
    });
    setIsMuted(!isMuted);
  };

  const handleDoubleTapLike = (reelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const reel = reels.find(r => r.id === reelId);
    if (reel && !reel.is_liked) {
      handleLike(reelId);
    }
    setLikeAnimations(prev => ({ ...prev, [reelId]: true }));
    setTimeout(() => {
      setLikeAnimations(prev => ({ ...prev, [reelId]: false }));
    }, 1000);

    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  const handleLike = async (reelId: string) => {
    if (likingReels.has(reelId)) return;

    setLikingReels(prev => new Set(prev).add(reelId));
    try {
      await likeReel(reelId);
      if ('vibrate' in navigator) {
        navigator.vibrate(30);
      }
    } finally {
      setLikingReels(prev => {
        const newSet = new Set(prev);
        newSet.delete(reelId);
        return newSet;
      });
    }
  };

  const handleSave = async (reelId: string) => {
    await toggleSaveReel(reelId);
  };

  const handleShare = async (reel: Reel) => {
    const shareData = {
      title: reel.caption || 'Check out this reel!',
      text: `Check out this reel by ${reel.creator_name}`,
      url: `${window.location.origin}/reels/${reel.id}`
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await copyToClipboard(shareData.url);
        }
      }
    } else {
      await copyToClipboard(shareData.url);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Link copied!' });
    } catch (error) {
      console.error('Could not copy reel link:', error);
      toast({ title: 'Could not copy the link', description: text, variant: 'destructive' });
    }
  };

  const handleFollowCreator = async (reel: Reel) => {
    if (!user) {
      toast({ title: 'Sign in to follow creators', variant: 'destructive' });
      return;
    }
    if (followActions.has(reel.user_id)) return;

    setFollowActions((previous) => new Set(previous).add(reel.user_id));
    try {
      if (followingIds.has(reel.user_id) || pendingFollowingIds.has(reel.user_id)) {
        await unfollowUser(reel.user_id);
        return;
      }
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_private')
        .eq('id', reel.user_id)
        .single();
      if (error) throw error;
      await followUser(reel.user_id, profile.is_private);
    } catch (error) {
      console.error('Could not follow reel creator:', error);
      toast({ title: 'Could not update follow status', variant: 'destructive' });
    } finally {
      setFollowActions((previous) => {
        const next = new Set(previous);
        next.delete(reel.user_id);
        return next;
      });
    }
  };

  const handleOpenComments = async (reelId: string) => {
    const fetchedComments = await fetchComments(reelId);
    const initialLikes = Object.fromEntries(fetchedComments.map((comment) => [comment.id, comment.likes_count || 0]));
    const initialLiked = new Set(fetchedComments.filter((comment) => comment.is_liked).map((comment) => comment.id));
    const initialPinned = new Set(fetchedComments.filter((comment) => comment.is_pinned).map((comment) => comment.id));
    setCommentLikes(initialLikes);
    setLikedComments(initialLiked);
    setPinnedComments(initialPinned);
    // Organize comments with replies
    const parentComments = fetchedComments.filter(c => !c.parent_id);
    const replies = fetchedComments.filter(c => c.parent_id);

    const commentsWithReplies = parentComments.map(comment => ({
      ...comment,
      replies: replies.filter(r => r.parent_id === comment.id),
      likes_count: initialLikes[comment.id] || 0,
      is_liked: initialLiked.has(comment.id),
      is_pinned: initialPinned.has(comment.id)
    }));

    // Sort: pinned first, then by date
    commentsWithReplies.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setComments(commentsWithReplies);
    setCommentsOpen(true);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || loadingComment) return;

    setLoadingComment(true);
    const reel = visibleReels[currentIndex];
    if (!reel) {
      setLoadingComment(false);
      return;
    }
    const createdComment = await addComment(reel.id, newComment, replyingTo || undefined);
    if (!createdComment) {
      setLoadingComment(false);
      return;
    }

    const updatedComments = await fetchComments(reel.id);
    const refreshedLikes = Object.fromEntries(updatedComments.map((comment) => [comment.id, comment.likes_count || 0]));
    const refreshedLiked = new Set(updatedComments.filter((comment) => comment.is_liked).map((comment) => comment.id));
    const refreshedPinned = new Set(updatedComments.filter((comment) => comment.is_pinned).map((comment) => comment.id));
    setCommentLikes(refreshedLikes);
    setLikedComments(refreshedLiked);
    setPinnedComments(refreshedPinned);
    const parentComments = updatedComments.filter(c => !c.parent_id);
    const replies = updatedComments.filter(c => c.parent_id);

    const commentsWithReplies = parentComments.map(comment => ({
      ...comment,
      replies: replies.filter(r => r.parent_id === comment.id),
      likes_count: refreshedLikes[comment.id] || 0,
      is_liked: refreshedLiked.has(comment.id),
      is_pinned: refreshedPinned.has(comment.id)
    }));

    commentsWithReplies.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setComments(commentsWithReplies);
    setNewComment('');
    setReplyingTo(null);
    setLoadingComment(false);
  };

  const handleReply = (commentId: string, userName: string) => {
    setReplyingTo(commentId);
    setNewComment(`@${userName} `);
    commentInputRef.current?.focus();
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user || commentActionLocks.current.has(commentId)) return;
    commentActionLocks.current.add(commentId);
    const wasLiked = likedComments.has(commentId);
    const previousCount = commentLikes[commentId] || 0;
    setLikedComments((previous) => {
      const next = new Set(previous);
      if (wasLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    setCommentLikes((previous) => ({
      ...previous,
      [commentId]: Math.max(0, previousCount + (wasLiked ? -1 : 1)),
    }));
    try {
      const result = wasLiked
        ? await supabase.from('reel_comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id)
        : await supabase.from('reel_comment_likes').insert({ comment_id: commentId, user_id: user.id });
      if (result.error) throw result.error;
    } catch (error) {
      setLikedComments((previous) => {
        const next = new Set(previous);
        if (wasLiked) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
      setCommentLikes((previous) => ({ ...previous, [commentId]: previousCount }));
      console.error('Could not update reel comment like:', error);
      toast({ title: 'Could not update comment like', variant: 'destructive' });
    } finally {
      commentActionLocks.current.delete(commentId);
    }
  };

  const handlePinComment = async (commentId: string) => {
    const reel = visibleReels[currentIndex];
    if (!reel) return;
    if (reel.user_id !== user?.id) {
      toast({ title: 'Only the reel author can pin comments', variant: 'destructive' });
      return;
    }
    if (pinnedCommentLock.current) return;
    pinnedCommentLock.current = true;

    const previousPinned = new Set(pinnedComments);
    const wasPinned = previousPinned.has(commentId);
    const nextPinned = wasPinned ? new Set<string>() : new Set([commentId]);
    const applyPinned = (pinned: Set<string>) => {
      setPinnedComments(pinned);
      setComments((previous) => [...previous]
        .map((comment) => ({ ...comment, is_pinned: pinned.has(comment.id) }))
        .sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }));
    };
    applyPinned(nextPinned);
    try {
      if (wasPinned) {
        const { error } = await supabase.from('reel_comment_pins')
          .delete()
          .eq('reel_id', reel.id)
          .eq('comment_id', commentId);
        if (error) throw error;
      } else if (user) {
        const { error } = await supabase.from('reel_comment_pins').upsert({
          reel_id: reel.id,
          comment_id: commentId,
          user_id: user.id,
        }, { onConflict: 'reel_id' });
        if (error) throw error;
      }
      toast({ title: wasPinned ? 'Comment unpinned' : 'Comment pinned' });
    } catch (error) {
      applyPinned(previousPinned);
      console.error('Could not update pinned reel comment:', error);
      toast({ title: 'Could not update pinned comment', variant: 'destructive' });
    } finally {
      pinnedCommentLock.current = false;
    }
  };

  const handleDeleteReel = async (reelId: string) => {
    await deleteReel(reelId);
    setCurrentIndex((index) => Math.max(0, Math.min(index, visibleReels.length - 1)));
  };

  const toggleShowReplies = (commentId: string) => {
    setShowReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const handleReelCreated = () => {
    setCreateDialogOpen(false);
    void fetchReels(true);
    if (activeTab === 'following') void fetchFollowingReels(true);
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatTimestamp = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: false })
        .replace('about ', '')
        .replace(' hours', 'h')
        .replace(' hour', 'h')
        .replace(' minutes', 'm')
        .replace(' minute', 'm')
        .replace(' days', 'd')
        .replace(' day', 'd')
        .replace(' weeks', 'w')
        .replace(' week', 'w')
        .replace(' months', 'mo')
        .replace(' month', 'mo')
        .replace('less than a', '<1');
    } catch {
      return '';
    }
  };

  const renderCaptionWithHashtags = (caption: string) => {
    const parts = caption.split(/(#[\w\u0590-\u05ff]+)/gi);
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return (
          <span
            key={index}
            className="text-blue-400 cursor-pointer hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/hashtag/${part.slice(1)}`);
            }}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const isOwnReel = (reelUserId: string) => {
    return user?.id === reelUserId;
  };

  if (activeTab === 'forYou' && loading && reels.length === 0) {
    return (
      <div className="h-[100dvh] bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-white" />
          <p className="text-white/70">Loading reels...</p>
        </div>
      </div>
    );
  }

  if (activeTab === 'forYou' && reels.length === 0) {
    return (
      <div className="h-[100dvh] bg-black flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6">
              <Film className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">No Reels Yet</h2>
            <p className="text-white/60 mb-8">
              Be the first to share your moment with the community!
            </p>
            <Button
              size="lg"
              onClick={() => setCreateDialogOpen(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-full px-8 py-6 text-lg font-semibold"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Reel
            </Button>
          </div>
        </div>
        <InstagramReelCreator
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onReelCreated={handleReelCreated}
        />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-black overflow-hidden relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/feed')}
            aria-label="Close reels"
            className="h-9 w-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-black/60 active:scale-95 transition touch-manipulation"
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-white">Reels</h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => selectTab('forYou')}
            className={cn(
              "min-h-11 px-1 text-sm font-semibold transition-all",
              activeTab === 'forYou' ? "text-white" : "text-white/50"
            )}
          >
            For You
          </button>
          <button
            onClick={() => selectTab('following')}
            className={cn(
              "min-h-11 px-1 text-sm font-semibold transition-all",
              activeTab === 'following' ? "text-white" : "text-white/50"
            )}
          >
            Following
          </button>
        </div>

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setCreateDialogOpen(true)}
          className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Reels Container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide touch-pan-y overscroll-contain"
        onScroll={handleScroll}
        style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {activeTab === 'following' && visibleReels.length === 0 ? (
          <div className="flex h-[100dvh] flex-col items-center justify-center px-8 text-center text-white">
            <Film className="mb-4 h-12 w-12 text-white/60" />
            <h2 className="text-xl font-semibold">
              {followingUsersLoading ? 'Loading followed creators…' : followingIds.size === 0 ? 'Follow creators to see their reels' : 'No reels from followed creators yet'}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-white/60">
              {followingIds.size === 0 ? 'When you follow someone, their reels will appear here.' : 'Check back later or discover more creators.'}
            </p>
            {followingIds.size === 0 && !followingUsersLoading && (
              <Button className="mt-5" variant="secondary" onClick={() => navigate('/explore')}>
                Explore creators
              </Button>
            )}
            {followingIds.size > 0 && followingHasMore && (
              <Button className="mt-5" variant="secondary" onClick={() => void fetchFollowingReels()}>
                Load more
              </Button>
            )}
            {followingFeedLoading && <Loader2 className="mt-5 h-6 w-6 animate-spin" />}
          </div>
        ) : visibleReels.map((reel, index) => (
          <div
            key={reel.id}
            className="h-[100dvh] w-full snap-start snap-always relative flex items-center justify-center bg-black"
            style={{ scrollSnapAlign: 'start' }}
          >
            {/* Video */}
            <video
              ref={(el) => {
                videoRefs.current[index] = el;
                if (el && observerRef.current) {
                  observerRef.current.observe(el);
                }
              }}
              src={reel.video_url}
              className="h-full w-full object-cover cursor-pointer"
              loop
              playsInline
              muted={isMuted}
              onClick={togglePlayPause}
              onDoubleClick={(e) => handleDoubleTapLike(reel.id, e)}
              preload={Math.abs(index - currentIndex) <= 2 ? 'auto' : 'none'}
            />

            {/* Double-tap like animation */}
            {likeAnimations[reel.id] && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <Heart
                  className="h-32 w-32 text-white animate-[scale-in_0.3s_ease-out] drop-shadow-2xl"
                  fill="white"
                />
              </div>
            )}

            {/* Play/Pause Overlay */}
            {!isPlaying && currentIndex === index && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="h-20 w-20 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                  <Play className="h-10 w-10 text-white ml-1" fill="white" />
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {currentIndex === index && (
              <div className="absolute top-16 left-4 right-4 z-20">
                <div className="h-0.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-100"
                    style={{ width: `${videoProgress[reel.id] || 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Right Side Actions */}
            <div
              className="absolute right-3 z-20 flex flex-col items-center gap-3"
              style={{ bottom: 'calc(max(env(safe-area-inset-bottom, 0px), 1rem) + 8rem)' }}
            >
              {/* Creator Avatar with Follow */}
              <div className="relative">
                <Avatar
                  className="h-12 w-12 ring-2 ring-white cursor-pointer"
                  onClick={() => navigate(`/profile/${reel.user_id}`)}
                >
                  <AvatarImage src={reel.creator_avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold">
                    {reel.creator_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {!isOwnReel(reel.user_id) && (
                  <button
                    type="button"
                    onClick={() => void handleFollowCreator(reel)}
                    disabled={followActions.has(reel.user_id)}
                    aria-label={pendingFollowingIds.has(reel.user_id) ? 'Cancel follow request' : followingIds.has(reel.user_id) ? 'Unfollow creator' : 'Follow creator'}
                    className="absolute -bottom-2 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-red-500 shadow-md disabled:opacity-60"
                  >
                    <Plus className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>

              {/* Like */}
              <button
                onClick={() => void handleLike(reel.id)}
                aria-label={reel.is_liked ? 'Unlike reel' : 'Like reel'}
                disabled={likingReels.has(reel.id)}
                className={cn(
                  "flex flex-col items-center gap-1 transition-transform",
                  likingReels.has(reel.id) ? "opacity-70" : "active:scale-90"
                )}
              >
                <Heart
                  className={cn(
                    "h-7 w-7 transition-all drop-shadow-lg",
                    reel.is_liked
                      ? "fill-red-500 text-red-500"
                      : "text-white"
                  )}
                />
                <span className="text-xs text-white font-semibold drop-shadow-md">
                  {formatCount(Math.max(0, reel.likes_count))}
                </span>
              </button>

              {/* Comment */}
              <button
                onClick={() => void handleOpenComments(reel.id)}
                aria-label="Open comments"
                className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
              >
                <MessageCircle className="h-7 w-7 text-white drop-shadow-lg" />
                <span className="text-xs text-white font-semibold drop-shadow-md">
                  {formatCount(reel.comments_count)}
                </span>
              </button>

              {/* Share */}
              <button
                onClick={() => void handleShare(reel)}
                aria-label="Share reel"
                className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
              >
                <Share2 className="h-6 w-6 text-white drop-shadow-lg" />
                <span className="text-xs text-white font-semibold drop-shadow-md">Share</span>
              </button>

              {/* Save */}
              <button
                onClick={() => void handleSave(reel.id)}
                aria-label={savedReelIds.has(reel.id) ? 'Remove saved reel' : 'Save reel'}
                className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
              >
                <Bookmark
                  className={cn(
                    "h-6 w-6 transition-all drop-shadow-lg",
                    savedReelIds.has(reel.id) ? "fill-white text-white" : "text-white"
                  )}
                />
              </button>

              {/* More Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="More reel actions" className="min-h-11 min-w-11 active:scale-90 transition-transform">
                    <MoreHorizontal className="h-6 w-6 text-white drop-shadow-lg" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-sm">
                  {isOwnReel(reel.user_id) ? (
                    <>
                      <DropdownMenuItem className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <span>{formatCount(reel.views_count)} views</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-2 text-destructive"
                        onClick={() => handleDeleteReel(reel.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Reel</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem className="flex items-center gap-2" onClick={() => void handleFollowCreator(reel)}>
                        <UserPlus className="h-4 w-4" />
                        <span>
                          {pendingFollowingIds.has(reel.user_id)
                            ? 'Cancel follow request'
                            : followingIds.has(reel.user_id)
                              ? `Unfollow ${reel.creator_name}`
                              : `Follow ${reel.creator_name}`}
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="flex items-center gap-2" onClick={() => setReportingUser(reel)}>
                        <Flag className="h-4 w-4" />
                        <span>Report</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Bottom Info */}
            <div
              className="absolute left-4 right-20 z-20 text-white"
              style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}
            >
              {/* Creator Info */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="font-bold text-base flex items-center gap-1 cursor-pointer drop-shadow-md"
                  onClick={() => navigate(`/profile/${reel.user_id}`)}
                >
                  {reel.creator_name}
                  {reel.is_verified && <VerificationBadge isVerified={true} />}
                </span>
                {!isOwnReel(reel.user_id) && (
                  <>
                    <span className="text-white/60">·</span>
                    <button
                      type="button"
                      onClick={() => void handleFollowCreator(reel)}
                      disabled={followActions.has(reel.user_id)}
                      className="min-h-11 px-2 text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-60"
                    >
                      {pendingFollowingIds.has(reel.user_id) ? 'Requested' : followingIds.has(reel.user_id) ? 'Following' : 'Follow'}
                    </button>
                  </>
                )}
                {isOwnReel(reel.user_id) && (
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full ml-1">Your reel</span>
                )}
              </div>

              {/* Caption */}
              {reel.caption && (
                <p className="text-sm leading-relaxed line-clamp-2 mb-3 drop-shadow-md">
                  {renderCaptionWithHashtags(reel.caption)}
                </p>
              )}

              {/* Music/Audio */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
                  <span className="text-[8px]">🎵</span>
                </div>
                <div className="overflow-hidden max-w-[200px]">
                  <p className="text-xs text-white/80 whitespace-nowrap">
                    Original Audio · {reel.creator_name}
                  </p>
                </div>
              </div>

              {/* View Count and Timestamp */}
              <div className="flex items-center gap-2 text-xs text-white/60">
                <Eye className="h-3 w-3" />
                <span>{formatCount(reel.views_count)} views</span>
                {reel.created_at && (
                  <>
                    <span>·</span>
                    <span>{formatTimestamp(reel.created_at)} ago</span>
                  </>
                )}
              </div>
            </div>

            {/* Mute Button */}
            <button
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute reel' : 'Mute reel'}
              className="absolute right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:scale-90 transition-transform"
              style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-white" />
              ) : (
                <Volume2 className="h-4 w-4 text-white" />
              )}
            </button>
          </div>
        ))}

        {loading && (
          <div className="h-[100dvh] flex items-center justify-center bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Create Reel Dialog */}
      <InstagramReelCreator
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onReelCreated={handleReelCreated}
      />
      {reportingUser && (
        <ReportUserDialog
          userId={reportingUser.user_id}
          userName={reportingUser.creator_name || 'this creator'}
          open={!!reportingUser}
          onOpenChange={(open) => { if (!open) setReportingUser(null); }}
        />
      )}

      {/* Comments Sheet */}
      <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl bg-background border-t border-border/50 p-0 flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 bg-background border-b border-border/50 px-4 py-3 rounded-t-3xl">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-3" />
            <h3 className="text-center font-semibold">
              Comments {comments.length > 0 && `(${comments.length})`}
            </h3>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium mb-1">No comments yet</p>
                <p className="text-sm text-muted-foreground">Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map(comment => (
                  <div key={comment.id} className="space-y-2">
                    {/* Pinned badge */}
                    {pinnedComments.has(comment.id) && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Pin className="h-3 w-3" />
                        <span>Pinned by creator</span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src={comment.user?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {comment.user?.display_name?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{comment.user?.display_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {comment.created_at ? formatTimestamp(comment.created_at) : ''}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5 break-words">{comment.content}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <button
                            onClick={() => handleReply(comment.id, comment.user?.display_name || '')}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Reply className="h-3 w-3" />
                            Reply
                          </button>
                          <button
                            onClick={() => handleLikeComment(comment.id)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Heart
                              className={cn(
                                "h-3 w-3",
                                likedComments.has(comment.id) && "fill-red-500 text-red-500"
                              )}
                            />
                            <span>{commentLikes[comment.id] || 0}</span>
                          </button>
                          {isOwnReel(visibleReels[currentIndex]?.user_id) && (
                            <button
                              onClick={() => handlePinComment(comment.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Pin className={cn("h-3 w-3", pinnedComments.has(comment.id) && "fill-primary text-primary")} />
                              {pinnedComments.has(comment.id) ? 'Unpin' : 'Pin'}
                            </button>
                          )}
                        </div>

                        {/* Replies */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleShowReplies(comment.id)}
                              className="text-xs text-primary font-medium"
                            >
                              {showReplies.has(comment.id)
                                ? 'Hide replies'
                                : `View ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`}
                            </button>

                            {showReplies.has(comment.id) && (
                              <div className="mt-2 space-y-3 pl-4 border-l-2 border-border/50">
                                {comment.replies.map(reply => (
                                  <div key={reply.id} className="flex gap-2">
                                    <Avatar className="h-7 w-7 flex-shrink-0">
                                      <AvatarImage src={reply.user?.avatar_url} />
                                      <AvatarFallback className="text-xs">
                                        {reply.user?.display_name?.[0]?.toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-xs">{reply.user?.display_name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {reply.created_at ? formatTimestamp(reply.created_at) : ''}
                                        </span>
                                      </div>
                                      <p className="text-xs mt-0.5">{reply.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comment Input */}
          <div className="flex-shrink-0 bg-background border-t border-border/50 px-4 py-3 pb-safe">
            {replyingTo && (
              <div className="flex items-center justify-between mb-2 px-2 py-1 bg-muted rounded-lg">
                <span className="text-xs text-muted-foreground">Replying to comment</span>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setNewComment('');
                  }}
                  className="text-xs text-primary"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="flex-1 relative">
                <Input
                  ref={commentInputRef}
                  placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  className="pr-12 rounded-full bg-muted border-0"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || loadingComment}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 rounded-full"
                >
                  {loadingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 text-primary" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
};

export default ReelsPage;