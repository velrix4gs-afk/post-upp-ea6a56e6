import { useState } from 'react';
import { createPortal } from 'react-dom';
import { shareOrigin } from '@/lib/siteUrl';
import { useParams } from 'react-router-dom';
import { ensurePrivateChat } from '@/lib/chatCreation';
import { ProfileHeader } from '@/components/ProfileHeader';
import ProfileEdit from '@/components/ProfileEdit';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileTabs } from '@/components/ProfileTabs';
import { ProfileImageViewer } from '@/components/ProfileImageViewer';
import { FollowersDialog } from '@/components/FollowersDialog';
import { VerificationBadge } from '@/components/premium/VerificationBadge';
import { StoryHighlights } from '@/components/ShowcaseHighlights';
import { usePinnedPosts } from '@/hooks/usePinnedPosts';
import { useUserReplies } from '@/hooks/useUserReplies';
import { useUserLikes } from '@/hooks/useUserLikes';
import { Helmet } from 'react-helmet-async';
import { copyToClipboard } from '@/lib/clipboard';
import { EXTRA_SOCIAL_PLATFORMS } from '@/lib/socialPlatforms';
import { Edit, MapPin, Calendar, Link as LinkIcon, Heart, Camera, UserPlus, UserCheck, MessageCircle, Pin, MessageSquare, Share2, MoreHorizontal, ExternalLink, Lock, Loader2, Instagram, Twitter, Music2, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePosts } from '@/hooks/usePosts';
import { useFriends } from '@/hooks/useFriends';
import { useFollowers } from '@/hooks/useFollowers';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { canViewFullProfile } from '@/lib/profilePrivacy';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import GradualBlur from '@/components/flair/GradualBlur';
import { cn } from '@/lib/utils';

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
  } catch { return null; }
};

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || url.includes('/video/');

const ProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const requestedProfileKey = userId || user?.id;
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile(requestedProfileKey);

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const profileUserId = profile?.id || (requestedProfileKey && uuidPattern.test(requestedProfileKey) ? requestedProfileKey : undefined);
  const isOwnProfile = profileUserId === user?.id;

  const { posts, loading: postsLoading } = usePosts(profileUserId, Boolean(profile?.id));
  const { friends } = useFriends();
  const { followers, following } = useFollowers(profileUserId);
  const { following: viewerFollowing, pendingFollowing: viewerPendingFollowing, followUser: followViewer, unfollowUser: unfollowViewer } = useFollowers(user?.id);

  const [activeTab, setActiveTab] = useState('posts');
  const { pinnedPostIds = [] } = usePinnedPosts(profileUserId);
  const { replies: userReplies, loading: repliesLoading } = useUserReplies(profileUserId, activeTab === 'replies');
  const { likedPosts, loading: likesLoading } = useUserLikes(profileUserId, activeTab === 'likes');

  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showFollowersDialog, setShowFollowersDialog] = useState(false);
  const [showFollowingDialog, setShowFollowingDialog] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [showCoverViewer, setShowCoverViewer] = useState(false);

  const [followActionBusy, setFollowActionBusy] = useState(false);
  const [messageActionBusy, setMessageActionBusy] = useState(false);
  const [optimisticFollow, setOptimisticFollow] = useState<boolean | null>(null);

  const handleProfileEditClose = () => {
    setShowProfileEdit(false);
    refetchProfile();
  };

  const userPosts = posts.filter(post => post.user_id === profileUserId);
  const pinnedPosts = userPosts.filter(post => pinnedPostIds.includes(post.id));
  const regularPosts = userPosts.filter(post => !pinnedPostIds.includes(post.id));
  const allPosts = [...pinnedPosts, ...regularPosts];

  const isFollowing = viewerFollowing.some(f => f.following_id === profileUserId);
  const hasFollowRequest = viewerPendingFollowing.some(f => f.following_id === profileUserId);

  const currentlyFollowing = optimisticFollow !== null ? optimisticFollow : isFollowing;

  const handleFollowToggle = async () => {
    if (!profileUserId || followActionBusy) return;
    setFollowActionBusy(true);
    const nextState = !currentlyFollowing;
    setOptimisticFollow(nextState);
    try {
      if (nextState) await followViewer(profileUserId, profile?.is_private || false);
      else await unfollowViewer(profileUserId);
    } catch (error) { setOptimisticFollow(null); } finally { setFollowActionBusy(false); }
  };

  const handleMessage = async () => {
    if (!profileUserId || !user || messageActionBusy) return;
    setMessageActionBusy(true);
    try {
      const chatId = await ensurePrivateChat(user.id, profileUserId);
      navigate(`/messages?chat=${chatId}`);
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to start conversation', variant: 'destructive' });
    } finally { setMessageActionBusy(false); }
  };

  const handleShare = async () => {
    const name = profile?.display_name || profile?.username || 'this user';
    const profileUrl = `${shareOrigin()}/profile/${profile?.username}`;
    const shareText = `Check out ${name}'s profile on Post Up! ${profileUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name}'s Profile`, text: shareText, url: profileUrl });
        return;
      } catch (error) { if ((error as DOMException)?.name === 'AbortError') return; }
    }
    const copied = await copyToClipboard(profileUrl);
    toast(copied ? { title: 'Link copied!', description: profileUrl } : { title: 'Could not copy the link', description: profileUrl, variant: 'destructive' });
  };

  const tabs = [
    { id: 'posts', label: 'Posts', count: userPosts.length },
    { id: 'replies', label: 'Replies', count: userReplies.length },
    { id: 'likes', label: 'Likes', count: likedPosts.length }
  ];

  if (profileLoading) {
    return <div className="min-h-screen bg-background"><div className="container mx-auto px-4 py-6 max-w-3xl"><Skeleton className="h-48 w-full rounded-lg mb-6" /><div className="flex items-center gap-4 mb-6"><Skeleton className="h-24 w-24 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-64" /></div></div></div></div>;
  }

  if (!profile) {
    return <div className="min-h-screen bg-background"><div className="container mx-auto px-4 py-6 max-w-3xl"><Card className="p-12 text-center"><h2 className="text-2xl font-bold mb-2">Profile not found</h2><p className="text-muted-foreground">This user doesn't exist or has been removed.</p></Card></div></div>;
  }

  const formatJoinDate = (dateString?: string | null) => {
    if (!dateString) return '';
    const parsed = new Date(dateString);
    if (isNaN(parsed.getTime())) return '';
    return format(parsed, 'MMMM yyyy');
  };

  const canViewFull = canViewFullProfile({ isOwnProfile, isPrivate: profile.is_private, isApprovedFollower: isFollowing, canViewFull: profile.can_view_full });

  return <div className="min-h-screen bg-background pb-20 md:pb-0">
    {profile && (() => {
      const shareTitle = `${profile.display_name || profile.username} (@${profile.username}) | POST UPP`;
      const shareDescription = (profile.bio || `See ${profile.display_name || profile.username}'s posts and showcases on POST UPP.`).slice(0, 200);
      const origin = shareOrigin();
      const shareUrl = `${origin}/profile/${profile.username}`;
      const previewImage = profile.avatar_url || profile.cover_url || undefined;
      return (
        <Helmet>
          <title>{shareTitle}</title>
          <meta name="description" content={shareDescription} />
          <link rel="canonical" href={shareUrl} />
          <meta property="og:type" content="profile" />
          <meta property="og:title" content={shareTitle} />
          <meta property="og:description" content={shareDescription} />
          <meta property="og:url" content={shareUrl} />
          <meta property="og:site_name" content="POST UPP" />
          {previewImage && <meta property="og:image" content={previewImage} />}
        </Helmet>
      );
    })()}

    <ProfileHeader displayName={profile?.display_name || ''} username={profile?.username || ''} postsCount={userPosts.length} isOwnProfile={isOwnProfile} />

    <main className="container mx-auto max-w-3xl px-4 py-5">

      {/* Header Info - Left Aligned like Instagram Mobile */}
      <div className="flex flex-row items-start gap-4 sm:gap-8 mb-6 mt-2">

        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="relative inline-block cursor-pointer group"
            onClick={() => profile?.avatar_url ? setShowAvatarViewer(true) : isOwnProfile && setShowProfileEdit(true)}
          >
            <Avatar className="h-20 w-20 sm:h-28 sm:w-28 md:h-36 md:w-36 ring-2 ring-border shadow-sm group-hover:ring-primary/40 transition-all">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile.display_name} className="object-cover" />
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl sm:text-4xl font-bold">
                  {profile?.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              )}
            </Avatar>
            {profile?.is_verified && (
              <div className="absolute bottom-0 right-0 p-0.5 bg-background rounded-full">
                <VerificationBadge isVerified={profile.is_verified} verificationType={profile.verification_type} />
              </div>
            )}
          </div>
        </div>

        {/* Info Area */}
        <div className="flex-1 flex flex-col items-start w-full text-left min-w-0">

          {/* Row 1: Display Name, Username & Action Buttons */}
          <div className="flex flex-row items-start justify-between w-full mb-3 gap-2">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold leading-tight truncate flex items-center gap-1">
                {profile?.display_name}
                {profile?.is_verified && <VerificationBadge isVerified={profile.is_verified} verificationType={profile.verification_type} />}
              </h1>
              <p className="text-sm text-muted-foreground truncate">@{profile?.username}</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isOwnProfile ? (
                <Button variant="secondary" size="sm" onClick={() => setShowProfileEdit(true)} className="h-8 rounded-lg font-semibold text-xs px-3">
                  Edit profile
                </Button>
              ) : (
                <>
                  <Button variant={currentlyFollowing || hasFollowRequest ? "secondary" : "default"} size="sm" onClick={handleFollowToggle} disabled={followActionBusy} className="h-8 rounded-lg font-semibold text-xs px-4">
                    {followActionBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    {currentlyFollowing ? 'Following' : hasFollowRequest ? 'Requested' : 'Follow'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleMessage} disabled={messageActionBusy} className="h-8 rounded-lg font-semibold text-xs px-3 hidden sm:flex">
                    Message
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Stats (Inline) */}
          <div className="flex items-center gap-4 sm:gap-6 mb-3 text-sm">
            <div><span className="font-bold">{userPosts.length}</span> <span className="text-muted-foreground">posts</span></div>
            <button onClick={() => setShowFollowersDialog(true)} className="hover:opacity-70 transition-opacity"><span className="font-bold">{followers.length}</span> <span className="text-muted-foreground">followers</span></button>
            <button onClick={() => setShowFollowingDialog(true)} className="hover:opacity-70 transition-opacity"><span className="font-bold">{following.length}</span> <span className="text-muted-foreground">following</span></button>
          </div>

          {/* Row 3: Bio & Metadata */}
          <div className="w-full">
            {canViewFull && profile?.bio && <p className="text-sm whitespace-pre-wrap font-medium">{profile.bio}</p>}
            {isOwnProfile && !profile?.bio && <button onClick={() => setShowProfileEdit(true)} className="text-sm text-muted-foreground hover:text-primary">+ Add a bio</button>}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              {canViewFull && profile?.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {profile.location}</span>}
              {canViewFull && profile?.website && <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline"><LinkIcon className="h-3 w-3" /> {profile.website.replace(/^https?:\/\//, '')}</a>}
              {canViewFull && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined {formatJoinDate(profile?.created_at || '')}</span>}
            </div>

            {/* Social Links */}
            {canViewFull && (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {[
                  { key: 'instagram', label: 'Instagram', domain: 'instagram.com', Icon: Instagram },
                  { key: 'twitter', label: 'X', domain: 'x.com', Icon: Twitter },
                  { key: 'tiktok', label: 'TikTok', domain: 'tiktok.com', Icon: Music2 },
                  ...EXTRA_SOCIAL_PLATFORMS.map(({ key, label, domain }) => ({ key, label, domain, Icon: LinkIcon })),
                ].map(({ key, label, domain, Icon }) => {
                  const value = profile.social_links?.[key] || profile.social_links?.[`${key}_url`];
                  const href = value ? getSocialHref(value, domain) : null;
                  if (!href) return null;
                  return <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Icon className="h-3 w-3" /> {label}</a>;
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Highlights */}
      {canViewFull && <div className="mb-4"><StoryHighlights userId={profileUserId!} isOwnProfile={isOwnProfile} /></div>}

      {canViewFull ? (
        <>
          <ProfileTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} sticky={true} />

          <div className="py-1">
            {/* Posts Tab - 3x3 GRID */}
            {activeTab === 'posts' && (
              <div className="grid grid-cols-3 gap-[1px] sm:gap-1 md:gap-2">
                {allPosts.length === 0 ? (
                  <div className="col-span-3 py-16 text-center text-muted-foreground flex flex-col items-center">
                    <Camera className="h-10 w-10 mb-3 opacity-20" />
                    <h3 className="text-lg font-semibold text-foreground mb-1">No posts yet</h3>
                    <p className="text-sm">{isOwnProfile ? 'Share your first post!' : "This user hasn't posted anything yet."}</p>
                  </div>
                ) : (
                  allPosts.map(post => {
                    const hasMedia = !!post.media_url;
                    const isVideo = hasMedia && isVideoUrl(post.media_url!);
                    return (
                      <div
                        key={post.id}
                        className="relative aspect-square overflow-hidden bg-muted cursor-pointer group"
                        onClick={() => navigate(`/post/${post.id}`)}
                      >
                        {hasMedia ? (
                          isVideo ? (
                            <div className="w-full h-full relative flex items-center justify-center bg-black/90">
                              <video src={post.media_url!} className="w-full h-full object-cover opacity-80" muted playsInline />
                              <Play className="absolute h-8 w-8 text-white/80 fill-white/80" />
                            </div>
                          ) : (
                            <img src={post.media_url!} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                          )
                        ) : (
                          <div className="flex items-center justify-center w-full h-full p-4 text-center bg-card border border-border/50">
                            <p className="text-xs font-medium line-clamp-4">{post.content || 'Text Post'}</p>
                          </div>
                        )}

                        {pinnedPostIds.includes(post.id) && (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm p-1.5 rounded-full">
                            <Pin className="h-3 w-3 text-white fill-white" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Replies Tab */}
            {activeTab === 'replies' && (
              <div className="space-y-4 pt-2">
                {repliesLoading ? (
                  <div className="space-y-4">{[1, 2, 3].map(i => <Card key={i} className="p-4"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-4 w-1/2" /></Card>)}</div>
                ) : userReplies.length === 0 ? (
                  <Card className="p-8 text-center"><MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" /><h3 className="text-lg font-semibold mb-2">No replies yet</h3><p className="text-muted-foreground">{isOwnProfile ? "When you reply to posts, they'll appear here." : "This user hasn't replied to any posts yet."}</p></Card>
                ) : (
                  <div className="space-y-4">
                    {userReplies.map(reply => <Card key={reply.id} className="p-4 hover:bg-muted/30 transition-colors">
                      {reply.post && <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1 cursor-pointer hover:text-foreground" onClick={() => navigate(`/post/${reply.post_id}`)}><span>Replying to</span><span className="font-medium">@{reply.post.profiles?.username || 'user'}</span></div>}
                      <p className="text-sm">{reply.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</p>
                    </Card>)}
                  </div>
                )}
              </div>
            )}

            {/* Likes Tab */}
            {activeTab === 'likes' && (
              <div className="grid grid-cols-3 gap-[1px] sm:gap-1 md:gap-2 pt-2">
                {likesLoading ? (
                  <div className="col-span-3 space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="aspect-square w-full" />)}</div>
                ) : likedPosts.length === 0 ? (
                  <div className="col-span-3 py-16 text-center text-muted-foreground flex flex-col items-center">
                    <Heart className="h-10 w-10 mb-3 opacity-20" />
                    <h3 className="text-lg font-semibold text-foreground mb-1">No liked posts</h3>
                    <p className="text-sm">{isOwnProfile ? "Posts you like will appear here." : "This user hasn't liked any posts yet."}</p>
                  </div>
                ) : (
                  likedPosts.map(post => (
                    <div key={post.id} className="relative aspect-square overflow-hidden bg-muted cursor-pointer" onClick={() => navigate(`/post/${post.id}`)}>
                      {post.media_url ? (
                        <img src={post.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full p-4 text-center bg-card border border-border/50"><p className="text-xs font-medium line-clamp-4">{post.content || 'Text Post'}</p></div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="px-4 py-10"><Card className="p-8 text-center"><Lock className="h-10 w-10 mx-auto mb-3 text-muted-foreground" /><h3 className="text-lg font-semibold mb-1">This account is private</h3><p className="text-sm text-muted-foreground">Follow to see posts and profile details.</p></Card></div>
      )}
    </main>

    {activeTab === 'posts' && canViewFull && typeof document !== 'undefined' && createPortal(
      <GradualBlur position="bottom" height="4.5rem" target="page" strength={1.6} layers={6} tint="hsl(var(--background))" autoHide zIndex={30} />, document.body
    )}

    {showProfileEdit && <ProfileEdit onClose={handleProfileEditClose} />}
    <FollowersDialog open={showFollowersDialog} onClose={() => setShowFollowersDialog(false)} users={followers.map(f => f.follower)} title="Followers" />
    <FollowersDialog open={showFollowingDialog} onClose={() => setShowFollowingDialog(false)} users={following.map(f => f.following)} title="Following" />
    {profile?.avatar_url && <ProfileImageViewer imageUrl={profile.avatar_url} alt={profile.display_name || 'Profile'} isOpen={showAvatarViewer} onClose={() => setShowAvatarViewer(false)} />}
    {profile?.cover_url && <ProfileImageViewer imageUrl={profile.cover_url} alt="Cover photo" isOpen={showCoverViewer} onClose={() => setShowCoverViewer(false)} />}
  </div>;
};
export default ProfilePage;