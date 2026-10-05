import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ensurePrivateChat } from '@/lib/chatCreation';
import { ProfileHeader } from '@/components/ProfileHeader';
import { PostCardModern } from '@/components/PostCard/PostCardModern';
import ProfileEdit from '@/components/ProfileEdit';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileTabs } from '@/components/ProfileTabs';
import { ProfileImageViewer } from '@/components/ProfileImageViewer';
import { VerificationBanner } from '@/components/VerificationBanner';
import { MutualFollowers } from '@/components/MutualFollowers';
import { UserInterestTags } from '@/components/UserInterestTags';
import { FollowersDialog } from '@/components/FollowersDialog';
import { VerificationBadge } from '@/components/premium/VerificationBadge';
import { StoryHighlights } from '@/components/StoryHighlights';
import { usePinnedPosts } from '@/hooks/usePinnedPosts';
import { useUserReplies } from '@/hooks/useUserReplies';
import { useUserLikes } from '@/hooks/useUserLikes';
import { Edit, MapPin, Calendar, Link as LinkIcon, Heart, Camera, UserPlus, UserCheck, MessageCircle, Pin, MessageSquare, Share2, MoreHorizontal, ExternalLink, Lock, Loader2, Instagram, Twitter, Music2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePosts } from '@/hooks/usePosts';
import { useFriends } from '@/hooks/useFriends';
import { useFollowers } from '@/hooks/useFollowers';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import CreatePost from '@/components/CreatePost';
import { canViewFullProfile } from '@/lib/profilePrivacy';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const getSocialHref = (value: string, domain: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /(?:^|\.)[a-z0-9-]+\.[a-z]{2,}(?:\/|$)/i.test(trimmed)
      ? `https://${trimmed.replace(/^\/+/, '')}`
      : `https://${domain}/${trimmed.replace(/^@/, '')}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

const ProfilePage = () => {
  const {
    userId
  } = useParams<{
    userId: string;
  }>();
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const requestedProfileKey = userId || user?.id;
  const {
    profile,
    loading: profileLoading,
    refetch: refetchProfile
  } = useProfile(requestedProfileKey);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const profileUserId = profile?.id || (requestedProfileKey && uuidPattern.test(requestedProfileKey) ? requestedProfileKey : undefined);
  const isOwnProfile = profileUserId === user?.id;
  const {
    posts,
    loading: postsLoading
  } = usePosts(profileUserId, Boolean(profile?.id));
  const {
    friends
  } = useFriends();
  const {
    followers,
    following,
  } = useFollowers(profileUserId);
  // Viewer's own following list — used to know if THIS viewer follows the
  // profile being displayed. Without this, `following` above is the profile
  // owner's list and the Follow button never reflects the viewer's state.
  const {
    following: viewerFollowing,
    pendingFollowing: viewerPendingFollowing,
    followUser: followViewer,
    unfollowUser: unfollowViewer,
  } = useFollowers(user?.id);
  const {
    pinnedPostIds
  } = usePinnedPosts(profileUserId);
  const {
    replies: userReplies,
    loading: repliesLoading
  } = useUserReplies(profileUserId);
  const {
    likedPosts,
    loading: likesLoading
  } = useUserLikes(profileUserId);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showFollowersDialog, setShowFollowersDialog] = useState(false);
  const [showFollowingDialog, setShowFollowingDialog] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [showCoverViewer, setShowCoverViewer] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [followActionBusy, setFollowActionBusy] = useState(false);
  const [messageActionBusy, setMessageActionBusy] = useState(false);
  const handleProfileEditClose = () => {
    setShowProfileEdit(false);
    refetchProfile();
  };
  const userPosts = posts.filter(post => post.user_id === profileUserId);
  const pinnedPosts = userPosts.filter(post => pinnedPostIds.includes(post.id));
  const regularPosts = userPosts.filter(post => !pinnedPostIds.includes(post.id));
  const isFollowing = viewerFollowing.some(f => f.following_id === profileUserId);
  const hasFollowRequest = viewerPendingFollowing.some(f => f.following_id === profileUserId);
  const handleFollowToggle = async () => {
    if (!profileUserId || followActionBusy) return;
    setFollowActionBusy(true);
    try {
      if (isFollowing || hasFollowRequest) {
        await unfollowViewer(profileUserId);
      } else {
        await followViewer(profileUserId, profile?.is_private || false);
      }
    } finally {
      setFollowActionBusy(false);
    }
  };
  const handleMessage = async () => {
    if (!profileUserId || !user || messageActionBusy) return;
    setMessageActionBusy(true);
    try {
      const chatId = await ensurePrivateChat(user.id, profileUserId);
      navigate(`/messages?chat=${chatId}`);
    } catch (error: unknown) {
      console.error('Message error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start conversation',
        variant: 'destructive'
      });
    } finally {
      setMessageActionBusy(false);
    }
  };
  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/profile/${profile?.username}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.display_name}'s Profile`,
          text: `Check out ${profile?.display_name}'s profile!`,
          url: profileUrl
        });
      } catch {
        // Sharing can be dismissed without taking action.
      }
    } else {
      await navigator.clipboard.writeText(profileUrl);
      toast({
        title: 'Link copied!',
        description: 'Profile link copied to clipboard'
      });
    }
  };
  const tabs = [{
    id: 'posts',
    label: 'Posts',
    count: userPosts.length
  }, {
    id: 'replies',
    label: 'Replies',
    count: userReplies.length
  }, {
    id: 'media',
    label: 'Media',
    count: userPosts.filter(p => p.media_url).length
  }, {
    id: 'likes',
    label: 'Likes',
    count: likedPosts.length
  }];
  if (profileLoading) {
    return <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Skeleton className="h-48 md:h-64 w-full rounded-lg mb-6" />
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-32 w-32 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
    </div>;
  }
  if (!profile) {
    return <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-bold mb-2">Profile not found</h2>
          <p className="text-muted-foreground">This user doesn't exist or has been removed.</p>
        </Card>
      </div>
    </div>;
  }
  const formatJoinDate = (dateString?: string | null) => {
    if (!dateString) return '';
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return '';
    return format(parsed, 'MMMM yyyy');
  };
  const canViewFull = canViewFullProfile({
    isOwnProfile,
    isPrivate: profile.is_private,
    isApprovedFollower: isFollowing,
    canViewFull: profile.can_view_full,
  });
  return <div className="min-h-screen bg-background pb-20 md:pb-0">
    {/* Sticky Profile Header */}
    <ProfileHeader displayName={profile?.display_name || ''} username={profile?.username || ''} postsCount={userPosts.length} isOwnProfile={isOwnProfile} />

    <main className="container mx-auto max-w-5xl px-4 py-5">
      {/* Cover Photo */}
      <div className="relative h-44 md:h-72 overflow-hidden cursor-pointer group rounded-3xl border border-border/70 shadow-sm" onClick={() => profile?.cover_url && setShowCoverViewer(true)}>
        {profile?.cover_url ? <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" /> : <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-accent/30 flex items-center justify-center">
          <div className="absolute -top-20 -right-10 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-28 -left-8 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex flex-col items-center gap-2 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border/50 bg-background/60 shadow-sm backdrop-blur">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            {isOwnProfile && <span className="text-sm font-medium text-foreground/75">Add a cover to make this space yours</span>}
          </div>
        </div>}
        {/* Gradient overlay */}
        {profile?.cover_url && <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />}
        {/* Change cover button for own profile */}
        {isOwnProfile && <div className="absolute bottom-3 right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="sm" className="gap-2 bg-background/80 backdrop-blur-sm hover:bg-background" onClick={e => {
            e.stopPropagation();
            setShowProfileEdit(true);
          }}>
            <Camera className="h-4 w-4" />
            Change Cover
          </Button>
        </div>}
      </div>

      {/* Profile Info Section */}
      <div className="relative z-10 -mt-12 mx-2 rounded-3xl border border-border/70 bg-card/95 px-4 pb-5 shadow-xl shadow-black/5 backdrop-blur-xl sm:mx-4 sm:px-6 md:-mt-16 md:mx-8 md:px-8 md:pb-7">
        {/* Avatar - overlapping cover */}
        <div className="relative -mt-16 md:-mt-20 mb-4">
          <div className="relative inline-block cursor-pointer group" onClick={() => profile?.avatar_url ? setShowAvatarViewer(true) : isOwnProfile && setShowProfileEdit(true)}>
            <Avatar className="h-28 w-28 md:h-36 md:w-36 ring-[5px] ring-card shadow-xl group-hover:ring-primary/30 transition-all">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.display_name} className="object-cover" /> : <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-4xl md:text-5xl font-bold">
                {profile?.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
              </AvatarFallback>}
            </Avatar>
            {profile?.is_verified && <div className="absolute bottom-1 right-1 p-0.5 bg-background rounded-full">
              <VerificationBadge isVerified={profile.is_verified} verificationType={profile.verification_type} />
            </div>}
            {isOwnProfile && !profile?.avatar_url && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-8 w-8 text-white" />
            </div>}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2 mb-5">
          {isOwnProfile ? <Button variant="outline" onClick={() => setShowProfileEdit(true)} className="flex-1 rounded-full font-semibold">
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button> : <>
            <Button variant={isFollowing || hasFollowRequest ? "outline" : "default"} onClick={handleFollowToggle} disabled={followActionBusy} className="flex-1 rounded-full font-semibold">
              {followActionBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isFollowing ? <>
                <UserCheck className="h-4 w-4 mr-2" />
                Following
              </> : hasFollowRequest ? <>
                <UserCheck className="h-4 w-4 mr-2" />
                Requested
              </> : <>
                <UserPlus className="h-4 w-4 mr-2" />
                Follow
              </>}
            </Button>
            <Button variant="outline" onClick={handleMessage} disabled={messageActionBusy} className="rounded-full px-4" aria-label="Message" title="Message">
              {messageActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            </Button>
          </>}
          <Button variant="outline" onClick={handleShare} className="rounded-full px-4" aria-label="Share profile" title="Share profile">
            <Share2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full px-4" aria-label="More profile options" title="More options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Copy link</DropdownMenuItem>
              {!isOwnProfile && <>
                <DropdownMenuItem className="text-destructive">Block</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Report</DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* User Info Block */}
        <div className="mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {profile?.display_name}
            </h1>
            {profile?.is_verified && <VerificationBadge isVerified={profile.is_verified} verificationType={profile.verification_type} />}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">@{profile?.username}</p>

          {/* Bio */}
          {canViewFull && profile?.bio ? <p className="mt-4 max-w-2xl text-sm leading-relaxed whitespace-pre-wrap">{profile.bio}</p> : isOwnProfile && <button onClick={() => setShowProfileEdit(true)} className="mt-4 rounded-xl border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
            + Add a bio to tell people about yourself
          </button>}
        </div>

        {/* Social + Metadata */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-5">
          {canViewFull && profile?.location && <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span>{profile.location}</span>
          </div>}
          {canViewFull && profile?.website && <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <LinkIcon className="h-3.5 w-3.5" />
            <span>{profile.website.replace(/^https?:\/\//, '')}</span>
            <ExternalLink className="h-3 w-3" />
          </a>}
          {canViewFull && [
            { key: 'instagram', label: 'Instagram', domain: 'instagram.com', Icon: Instagram },
            { key: 'twitter', label: 'X', domain: 'x.com', Icon: Twitter },
            { key: 'tiktok', label: 'TikTok', domain: 'tiktok.com', Icon: Music2 },
          ].map(({ key, label, domain, Icon }) => {
            const value = profile.social_links?.[key] || profile.social_links?.[`${key}_url`];
            const href = value ? getSocialHref(value, domain) : null;
            if (!href) return null;
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${profile.display_name}'s ${label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            );
          })}
          {canViewFull && <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Joined {formatJoinDate(profile?.created_at || '')}</span>
          </div>}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-card px-3 py-3 text-center">
            <span className="block text-lg font-bold tracking-tight">{userPosts.length}</span>
            <span className="text-xs text-muted-foreground">
              {userPosts.length === 1 ? 'Post' : 'Posts'}
            </span>
          </div>
          <button type="button" className="group rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-card px-3 py-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setShowFollowingDialog(true)} aria-label={`View ${following.length} following`}>
            <span className="block text-lg font-bold tracking-tight group-hover:text-primary">{following.length}</span>
            <span className="text-xs text-muted-foreground group-hover:text-primary">Following</span>
          </button>
          <button type="button" className="group rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-card px-3 py-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setShowFollowersDialog(true)} aria-label={`View ${followers.length} followers`}>
            <span className="block text-lg font-bold tracking-tight group-hover:text-primary">{followers.length}</span>
            <span className="text-xs text-muted-foreground group-hover:text-primary">
              {followers.length === 1 ? 'Follower' : 'Followers'}
            </span>
          </button>
        </div>

        {canViewFull && <MutualFollowers profileUserId={profileUserId!} />}

        {isOwnProfile && !profile?.is_verified && <div className="mt-4">
          <VerificationBanner isViewerVerified={profile?.is_verified} />
        </div>}

        {canViewFull && <div className="mt-4">
          <StoryHighlights userId={profileUserId!} isOwnProfile={isOwnProfile} />
        </div>}
      </div>

      {canViewFull ? <>
        {/* Tabs Navigation - Sticky */}
        <ProfileTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} sticky={true} />

        {/* Tab Content */}
        <div className="py-4 px-px">
          {/* Posts Tab */}
          {activeTab === 'posts' && <div className="space-y-4">
            {isOwnProfile && <CreatePost />}

            {/* Pinned Posts */}
            {pinnedPosts.length > 0 && <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Pin className="h-4 w-4" />
                Pinned
              </h3>
              {pinnedPosts.map(post => <PostCardModern key={post.id} post={{
                id: post.id,
                content: post.content || '',
                media_url: post.media_url,
                created_at: post.created_at,
                reactions_count: post.reactions_count,
                comments_count: post.comments_count,
                shares_count: post.shares_count || 0,
                author_name: profile?.display_name || '',
                author_username: profile?.username || '',
                author_avatar: profile?.avatar_url,
                author_id: post.user_id,
                is_verified: profile?.is_verified,
                is_pinned: true
              }} />)}
            </div>}

            {userPosts.length === 0 ? <Card className="p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? 'Share your first post!' : 'This user hasn\'t posted anything yet.'}
              </p>
            </Card> : <div className="space-y-4">
              {regularPosts.map(post => <PostCardModern key={post.id} post={{
                id: post.id,
                content: post.content || '',
                media_url: post.media_url,
                created_at: post.created_at,
                reactions_count: post.reactions_count,
                comments_count: post.comments_count,
                shares_count: post.shares_count || 0,
                author_name: profile?.display_name || '',
                author_username: profile?.username || '',
                author_avatar: profile?.avatar_url,
                author_id: post.user_id,
                is_verified: profile?.is_verified
              }} />)}
            </div>}
          </div>}

          {/* Replies Tab */}
          {activeTab === 'replies' && <div className="space-y-4">
            {repliesLoading ? <div className="space-y-4">
              {[1, 2, 3].map(i => <Card key={i} className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </Card>)}
            </div> : userReplies.length === 0 ? <Card className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No replies yet</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "When you reply to posts, they'll appear here." : "This user hasn't replied to any posts yet."}
              </p>
            </Card> : <div className="space-y-4">
              {userReplies.map(reply => <Card key={reply.id} className="p-4 hover:bg-muted/30 transition-colors">
                {reply.post && <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1 cursor-pointer hover:text-foreground" onClick={() => navigate(`/post/${reply.post_id}`)}>
                  <span>Replying to</span>
                  <span className="font-medium">@{reply.post.profiles?.username || 'user'}</span>
                </div>}
                <p className="text-sm">{reply.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(reply.created_at), {
                    addSuffix: true
                  })}
                </p>
              </Card>)}
            </div>}
          </div>}

          {/* Media Tab */}
          {activeTab === 'media' && <div>
            <div className="grid grid-cols-3 gap-1">
              {userPosts.filter(post => post.media_url).map(post => <div key={post.id} className="aspect-square overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onClick={() => navigate(`/post/${post.id}`)}>
                <img src={post.media_url} alt="" className="w-full h-full object-cover" />
              </div>)}
            </div>
            {!userPosts.some(p => p.media_url) && <Card className="p-8 text-center">
              <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No media yet</h3>
              <p className="text-muted-foreground">
                Photos and videos will appear here
              </p>
            </Card>}
          </div>}

          {/* Likes Tab */}
          {activeTab === 'likes' && <div className="space-y-4">
            {likesLoading ? <div className="space-y-4">
              {[1, 2, 3].map(i => <Card key={i} className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </Card>)}
            </div> : likedPosts.length === 0 ? <Card className="p-8 text-center">
              <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No liked posts</h3>
              <p className="text-muted-foreground">
                {isOwnProfile ? "Posts you like will appear here." : "This user hasn't liked any posts yet."}
              </p>
            </Card> : <div className="space-y-4">
              {likedPosts.map(post => <PostCardModern key={post.id} post={{
                id: post.id,
                content: post.content || '',
                media_url: post.media_url,
                created_at: post.created_at,
                reactions_count: post.reactions_count,
                comments_count: post.comments_count,
                shares_count: 0,
                author_name: post.profiles?.display_name || 'Unknown',
                author_username: post.profiles?.username || '',
                author_avatar: post.profiles?.avatar_url,
                author_id: post.user_id,
                is_verified: post.profiles?.is_verified
              }} />)}
            </div>}
          </div>}
        </div>
      </> : <div className="px-4 py-10">
        <Card className="p-8 text-center">
          <Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-1">This account is private</h3>
          <p className="text-sm text-muted-foreground">
            Follow to see posts and profile details. Phone, birth date and gender stay visible only to this person.
          </p>
        </Card>
      </div>}
    </main>

    {/* Modals */}
    {showProfileEdit && <ProfileEdit onClose={handleProfileEditClose} />}

    <FollowersDialog open={showFollowersDialog} onClose={() => setShowFollowersDialog(false)} users={followers.map(f => f.follower)} title="Followers" />

    <FollowersDialog open={showFollowingDialog} onClose={() => setShowFollowingDialog(false)} users={following.map(f => f.following)} title="Following" />

    {/* Image Viewers */}
    {profile?.avatar_url && <ProfileImageViewer imageUrl={profile.avatar_url} alt={profile.display_name || 'Profile'} isOpen={showAvatarViewer} onClose={() => setShowAvatarViewer(false)} />}

    {profile?.cover_url && <ProfileImageViewer imageUrl={profile.cover_url} alt="Cover photo" isOpen={showCoverViewer} onClose={() => setShowCoverViewer(false)} />}
  </div>;
};
export default ProfilePage;