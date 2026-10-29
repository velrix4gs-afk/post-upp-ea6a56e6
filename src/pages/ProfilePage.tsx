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
import { VerificationBanner } from '@/components/VerificationBanner';
import { MutualFollowers } from '@/components/MutualFollowers';
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
  } catch {
    return null;
  }
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

  const handleProfileEditClose = () => {
    setShowProfileEdit(false);
    refetchProfile();
  };

  const userPosts = posts.filter(post => post.user_id === profileUserId);
  const pinnedPosts = userPosts.filter(post => pinnedPostIds.includes(post.id));
  const regularPosts = userPosts.filter(post => !pinnedPostIds.includes(post.id));
  const allPosts = [...pinnedPosts, ...regularPosts]; // For the grid

  const isFollowing = viewerFollowing.some(f => f.following_id === profileUserId);
  const hasFollowRequest = viewerPendingFollowing.some(f => f.following_id === profileUserId);

  const handleFollowToggle = async () => {
    if (!profileUserId || followActionBusy) return;
    setFollowActionBusy(true);
    try {
      if (isFollowing || hasFollowRequest) await unfollowViewer(profileUserId);
      else await followViewer(profileUserId, profile?.is_private || false);
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
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to start conversation', variant: 'destructive' });
    } finally {
      setMessageActionBusy(false);
    }
  };

  const handleShare = async () => {
    const name = profile?.display_name || profile?.username || 'this user';
    const profileUrl = `${shareOrigin()}/profile/${profile?.username}`;
    const shareText = `Check out ${name}'s profile on Post Up! ${profileUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name}'s Profile`, text: shareText, url: profileUrl });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return;
      }
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
    return <div className="min-h-screen bg-background"><div className="container mx-auto px-4 py-6 max-w-4xl"><Skeleton className="h-48 w-full rounded-lg mb-6" /><div className="flex items-center gap-4 mb-6"><Skeleton className="h-32 w-32 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-64" /></div></div></div></div>;
  }

  if (!profile) {
    return <div className="min-h-screen bg-background"><div className="container mx-auto px-4 py-6 max-w-4xl"><Card className="p-12 text-center"><h2 className="text-2xl font-bold mb-2">Profile not found</h2><p className="text-muted-foreground">This user doesn't exist or has been removed.</p></Card></div></div>;
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

      {/* Header Info (Avatar, Stats, Bio) - Instagram Style */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 md:gap-10 mb-8 mt-2">

        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="relative inline-block cursor-pointer group"
            onClick={() => profile?.avatar_url ? setShowAvatarViewer(true) : isOwnProfile && setShowProfileEdit(true)}
          >
            <Avatar className="h-24 w-24 md:h-36 md:w-36 ring-2 ring-border shadow-sm group-hover:ring-primary/40 transition-all">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile.display_name} className="object-cover" />
              ) : (
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-4xl font-bold">
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
        <div className="flex-1 flex flex-col items-center sm:items-start w-full">
          {/* Username & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 w-full sm:w-auto">
            <h1 className="text-xl font-semibold">{profile?.username}</h1>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {isOwnProfile ? (
                <Button variant="secondary" size="sm" onClick={() => setShowProfileEdit(true)} className="flex-1 sm:flex-none h-8 rounded-lg font-semibold text-xs">
                  Edit profile
                </Button>
              ) : (
                <>
                  <Button variant={isFollowing || hasFollowRequest ? "secondary" : "default"} size="sm" onClick={handleFollowToggle} disabled={followActionBusy} className="flex-1 sm:flex-none h-8 rounded-lg font-semibold text-xs">
                    {followActionBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    {isFollowing ? 'Following' : hasFollowRequest ? 'Requested' : 'Follow'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleMessage} disabled={messageActionBusy} className="h-8 rounded-lg font-semibold text-xs">
                    Message
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Stats (Inline) */}
          <div className="flex items-center gap-6 mb-4 text-sm md:text-base">
            <div><span className="font-semibold">{userPosts.length}</span> posts</div>
            <button onClick={() => setShowFollowersDialog(true)} className="hover:text-muted-foreground transition-colors"><span className="font-semibold">{followers.length}</span> followers</button>
            <button onClick={() => setShowFollowingDialog(true)} className="hover:text-muted-foreground transition-colors"><span className="font-semibold">{following.length}</span> following</button>
          </div>

          {/* Name & Bio */}
          <div className="text-center sm:text-left">
            <p className="font-semibold text-sm">{profile?.display_name}</p>
            {canViewFull && profile?.bio && <p className="text-sm whitespace-pre-wrap mt-0.5">{profile.bio}</p>}
            {isOwnProfile && !profile?.bio && <button onClick={() => setShowProfileEdit(true)} className="text-sm text-muted-foreground hover:text-primary mt-1">+ Add a bio</button>}

            {/* Metadata */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2 text-xs text-muted-foreground">
              {canViewFull && profile?.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {profile.location}</span>}
              {canViewFull && profile?.website && <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline"><LinkIcon className="h-3 w-3" /> {profile.website.replace(/^https?:\/\//, '')}</a>}
              {canViewFull && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined {formatJoinDate(profile?.created_at || '')}</span>}
            </div>

            {/* Social Links */}
            {canViewFull && (
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
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
      {canViewFull && <div className="mb-6 border-t border-border/50 pt-4"><StoryHighlights userId={profileUserId!} isOwnProfile={isOwnProfile} /></div>}

      {canViewFull ? (
        <>
          <ProfileTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} sticky={true} />

          <div className="py-2">
            {/* Posts Tab - 3x3 GRID */}
            {activeTab === 'posts' && (
              <div className="grid grid-cols-3 gap-1 md:gap-2">
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

                        {/* Pinned Indicator Overlay */}
                        {pinnedPostIds.includes(post.id) && (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm p-1.5 rounded-full">
                            <Pin className="h-3 w-3 text-white fill-white" />
                          </div>
                        )}

                        {/* Hover Stats Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white font-semibold text-sm">
                          <span className="flex items-center gap-1"><Heart className="h-4 w-4 fill-white" /> {post.reactions_count}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="h-4 w-4 fill-white" /> {post.comments_count}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Replies Tab */}
            {activeTab === 'replies' && (
              <div className="space-y-4">
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
              <div className="grid grid-cols-3 gap-1 md:gap-2">
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