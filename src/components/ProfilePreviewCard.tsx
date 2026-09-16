import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerificationBadge } from "@/components/premium/VerificationBadge";
import { UserPlus, UserCheck, Camera, Users } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { canViewFullProfile } from "@/lib/profilePrivacy";
import { useFollowers } from "@/hooks/useFollowers";
import { usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface ProfilePreviewCardProps {
  userId: string;
  onClose?: () => void;
}

export const ProfilePreviewCard = ({ userId, onClose }: ProfilePreviewCardProps) => {
  const { user } = useAuth();
  const { profile, loading } = useProfile(userId);
  const { followers, following, followUser, unfollowUser } = useFollowers(userId);
  const { posts } = usePosts();
  const navigate = useNavigate();

  const isOwnProfile = userId === user?.id;
  const isFollowing = following.some(f => f.following_id === userId);
  const userPostsCount = posts.filter(p => p.user_id === userId).length;

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFollowing) {
      await unfollowUser(userId);
    } else {
      await followUser(userId, profile?.is_private || false);
    }
  };

  const handleProfileClick = () => {
    navigate(`/profile/${userId}`);
    onClose?.();
  };

  if (loading) {
    return (
      <Card className="w-80 overflow-hidden shadow-2xl border-border/30 backdrop-blur-xl bg-card/95 animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="relative h-24 bg-gradient-to-r from-primary/20 to-accent/20">
          <Skeleton className="absolute -bottom-10 left-4 h-20 w-20 rounded-full border-4 border-background" />
        </div>
        <div className="p-4 pt-12">
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  if (!profile) return null;

  const canViewFull = canViewFullProfile({
    isOwnProfile,
    isPrivate: profile.is_private,
    isApprovedFollower: isFollowing,
    canViewFull: profile.can_view_full,
  });

  return (
    <Card 
      className="w-80 overflow-hidden border-border/30 cursor-pointer transition-all duration-300 animate-in fade-in-0 zoom-in-95 profile-preview-card"
      onClick={handleProfileClick}
    >
      {/* Cover Photo with gradient overlay */}
      <div className="relative h-28 overflow-hidden">
        {profile.cover_url ? (
          <>
            <img 
              src={profile.cover_url} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary via-primary/80 to-accent flex items-center justify-center">
            <Camera className="h-8 w-8 text-white/30" />
          </div>
        )}
        
        {/* Profile Picture - overlapping cover */}
        <div className="absolute -bottom-12 left-4 z-10">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-4 border-card ring-2 ring-primary/30 shadow-lg transition-transform duration-200 group-hover:scale-105">
              <AvatarImage src={profile.avatar_url} alt={profile.display_name} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl font-bold">
                {profile.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            {profile.is_verified && (
              <div className="absolute -bottom-1 -right-1 bg-card rounded-full p-0.5">
                <VerificationBadge 
                  isVerified={profile.is_verified}
                  verificationType={profile.verification_type}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-14 pb-4">
        {/* Name and Username */}
        <div className="mb-2">
          <h3 className="text-lg font-bold flex items-center gap-1.5 leading-tight">
            {profile.display_name}
          </h3>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-1 mb-4 bg-muted/50 rounded-xl p-2">
          <div className="text-center p-2 rounded-lg hover:bg-background/80 transition-colors cursor-pointer">
            <div className="text-lg font-bold text-foreground">{following.length}</div>
            <div className="text-xs text-muted-foreground font-medium">Following</div>
          </div>
          <div className="text-center p-2 rounded-lg hover:bg-background/80 transition-colors cursor-pointer border-x border-border/50">
            <div className="text-lg font-bold text-foreground">{followers.length}</div>
            <div className="text-xs text-muted-foreground font-medium">Followers</div>
          </div>
          <div className="text-center p-2 rounded-lg hover:bg-background/80 transition-colors cursor-pointer">
            <div className="text-lg font-bold text-foreground">{userPostsCount}</div>
            <div className="text-xs text-muted-foreground font-medium">Posts</div>
          </div>
        </div>

        {/* Follow Button */}
        {!isOwnProfile && (
          <Button
            className="w-full rounded-xl font-semibold h-10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            variant={isFollowing ? "outline" : "default"}
            onClick={handleFollowToggle}
          >
            {isFollowing ? (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Follow
              </>
            )}
          </Button>
        )}

        {/* Tabs Navigation */}
        <Tabs defaultValue="posts" className="mt-4">
          <TabsList className="grid w-full grid-cols-4 h-9 bg-muted/50 rounded-xl p-1">
            <TabsTrigger value="posts" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Posts</TabsTrigger>
            <TabsTrigger value="replies" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Replies</TabsTrigger>
            <TabsTrigger value="media" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Media</TabsTrigger>
            <TabsTrigger value="likes" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Likes</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </Card>
  );
};