import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ensurePrivateChat } from '@/lib/chatCreation';
import Navigation from '@/components/Navigation';
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
import { Edit, MapPin, Calendar, Link as LinkIcon, Heart, Camera, UserPlus, UserCheck, MessageCircle, Pin, MessageSquare, Share2, MoreHorizontal, ExternalLink, Lock, Loader2 } from 'lucide-react';
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
  const profileUserId = userId || user?.id;
  const isOwnProfile = profileUserId === user?.id;
  const {
    profile: currentUserProfile
  } = useProfile(user?.id);
  const {
    profile,
    loading: profileLoading,
    refetch: refetchProfile
  } = useProfile(profileUserId);
  const {
    posts,
    loading: postsLoading
  } = usePosts();
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
      } catch (error) { }
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
      <Navigation />
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
      <Navigation />
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
    <Navigation />

    {/* Sticky Profile Header */}
    <ProfileHeader displayName={profile?.display_name || ''} username={profile?.username || ''} postsCount={userPosts.length} isOwnProfile={isOwnProfile} />

    <main className="container mx-auto max-w-4xl">
      {/* Cover Photo */}
      <div className="relative h-40 md:h-56 overflow-hidden cursor-pointer group" onClick={() => profile?.cover_url && setShowCoverViewer(true)}>
        {profile?.cover_url ? <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/20 to-accent/30 flex items-center justify-center">
          <Camera className="h-12 w-12 text-muted-foreground/40" />
        </div>}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        {/* Change cover button for own profile */}
        {isOwnProfile && <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
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
      <div className="px-4 relative">
        {/* Avatar - overlapping cover */}
        <div className="relative -mt-16 md:-mt-20 mb-4">
          <div className="relative inline-block cursor-pointer group" onClick={() => profile?.avatar_url ? setShowAvatarViewer(true) : isOwnProfile && setShowProfileEdit(true)}>
            <Avatar className="h-32 w-32 md:h-40 md:w-40 ring-4 ring-background shadow-xl group-hover:ring-primary/30 transition-all">
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
        <div className="flex items-center gap-2 mb-4">
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
            <Button variant="outline" onClick={handleMessage} disabled={messageActionBusy} className="rounded-full px-4" aria-label="Message">
              {messageActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            </Button>
          </>}
          <Button variant="outline" onClick={handleShare} className="rounded-full px-4">
            <Share2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full px-4">
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
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold">
              {profile?.display_name}
            </h1>
            {profile?.is_verified && <VerificationBadge isVerified={profile.is_verified} verificationType={profile.verification_type} />}
          </div>
          <p className="text-muted-foreground">@{profile?.username}</p>

          {/* Bio */}
          {canViewFull && profile?.bio ? <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{profile.bio}</p> : isOwnProfile && <button onClick={() => setShowProfileEdit(true)} className="mt-3 text-sm text-muted-foreground hover:text-primary transition-colors">
            + Add a bio to tell people about yourself
          </button>}
        </div>

        {/* Social + Metadata */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
          {canViewFull && profile?.location && <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>{profile.location}</span>
          </div>}
          {canViewFull && profile?.website && <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <LinkIcon className="h-4 w-4" />
            <span>{profile.website.replace(/^https?:\/\//, '')}</span>
            <ExternalLink className="h-3 w-3" />
          </a>}
          {canViewFull && <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>Joined {formatJoinDate(profile?.created_at || '')}</span>
          </div>}
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 mb-3 text-sm">
          <div className="group">
            <span className="font-bold">{userPosts.length}</span>
            <span className="text-muted-foreground ml-1">
              {userPosts.length === 1 ? 'Post' : 'Posts'}
            </span>
          </div>
          <div className="text-muted-foreground">•</div>
          <div className="cursor-pointer group hover:text-primary transition-colors" onClick={() => setShowFollowingDialog(true)}>
            <span className="font-bold group-hover:underline">{following.length}</span>
            <span className="text-muted-foreground group-hover:text-primary ml-1">Following</span>
          </div>
          <div className="text-muted-foreground">•</div>
          <div className="cursor-pointer group hover:text-primary transition-colors" onClick={() => setShowFollowersDialog(true)}>
            <span className="font-bold group-hover:underline">{followers.length}</span>
            <span className="text-muted-foreground group-hover:text-primary ml-1">
              {followers.length === 1 ? 'Follower' : 'Followers'}
            </span>
          </div>
        </div>

        {canViewFull && <MutualFollowers profileUserId={profileUserId!} />}

        {isOwnProfile && !currentUserProfile?.is_verified && <div className="mt-4">
          <VerificationBanner isViewerVerified={currentUserProfile?.is_verified} />
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