import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useFollowers } from '@/hooks/useFollowers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { VerificationBadge } from '@/components/premium/VerificationBadge';
import { 
  Home, 
  Search, 
  Bell, 
  MessageCircle, 
  Bookmark, 
  User, 
  Users, 
  Compass,
  Settings,
  BadgeCheck,
  Crown,
  FileText,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  path: string;
  isActive?: boolean;
  badge?: number;
}

const SidebarItem = ({ icon: Icon, label, path, isActive, badge }: SidebarItemProps) => {
  const navigate = useNavigate();
  
  return (
    <button
      onClick={() => navigate(path)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
        "hover:bg-muted group",
        isActive && "bg-primary/10 text-primary font-semibold"
      )}
    >
      <div className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
        isActive ? "bg-primary/20" : "bg-muted group-hover:bg-primary/10"
      )}>
        <Icon className={cn(
          "h-5 w-5 transition-colors",
          isActive ? "text-primary" : "text-foreground group-hover:text-primary"
        )} />
      </div>
      <span className="text-sm">{label}</span>
      {badge && badge > 0 && (
        <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-0.5 rounded-full">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
};

export const FeedSidebar = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { followers, following } = useFollowers();
  const navigate = useNavigate();
  const location = useLocation();
  
  const currentPath = location.pathname;

  const mainItems = [
    { icon: Home, label: 'Home', path: '/feed' },
    { icon: Search, label: 'Explore', path: '/explore' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
    { icon: MessageCircle, label: 'Messages', path: '/messages' },
    { icon: Bookmark, label: 'Bookmarks', path: '/bookmarks' },
    { icon: Users, label: 'Friends', path: '/friends' },
    { icon: User, label: 'Profile', path: `/profile/${profile?.username || user?.id}` },
  ];

  const moreItems = [
    { icon: FileText, label: 'Pages', path: '/pages' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-0 h-screen overflow-y-auto p-4 scrollbar-hide">
      {/* User Profile Card */}
      <Card className="p-4 mb-4">
        <button 
          onClick={() => navigate(`/profile/${profile?.username || user?.id}`)}
          className="flex items-center gap-3 w-full hover:bg-muted/50 rounded-xl p-2 -m-2 transition-colors"
        >
          <Avatar className="h-12 w-12 ring-2 ring-border">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {profile?.display_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm truncate">{profile?.display_name || 'User'}</span>
              <VerificationBadge 
                isVerified={profile?.is_verified}
                verificationType={profile?.verification_type}
              />
            </div>
            <span className="text-xs text-muted-foreground">@{profile?.username || 'username'}</span>
          </div>
        </button>

        {/* Stats */}
        <div className="flex items-center justify-around mt-4 pt-4 border-t border-border">
          <button 
            onClick={() => navigate(`/profile/${profile?.username || user?.id}`)}
            className="text-center hover:bg-muted/50 rounded-lg px-3 py-1 transition-colors"
          >
            <div className="font-bold text-foreground">{following.length}</div>
            <div className="text-xs text-muted-foreground">Following</div>
          </button>
          <button 
            onClick={() => navigate(`/profile/${profile?.username || user?.id}`)}
            className="text-center hover:bg-muted/50 rounded-lg px-3 py-1 transition-colors"
          >
            <div className="font-bold text-foreground">{followers.length}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </button>
        </div>
      </Card>

      {/* Navigation */}
      <Card className="p-2 mb-4">
        <nav className="space-y-1">
          {mainItems.map((item) => (
            <SidebarItem
              key={item.path}
              {...item}
              isActive={currentPath === item.path || currentPath.startsWith(item.path + '/')}
            />
          ))}
        </nav>
      </Card>

      {/* More Section */}
      <Card className="p-2 mb-4">
        <nav className="space-y-1">
          {moreItems.map((item) => (
            <SidebarItem
              key={item.path}
              {...item}
              isActive={currentPath === item.path}
            />
          ))}
        </nav>
      </Card>

      {/* Verification CTA */}
      {!profile?.is_verified && (
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <BadgeCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Get Verified</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Stand out with the verified badge
              </p>
              <Button 
                size="sm" 
                className="mt-3 w-full bg-primary hover:bg-primary-hover"
                onClick={() => navigate('/verification')}
              >
                Get Verified
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Premium CTA */}
      <Card className="p-4 mt-4 bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
            <Crown className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm">Go Premium</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Unlock exclusive features
            </p>
            <Button 
              size="sm" 
              variant="outline"
              className="mt-3 w-full border-warning/50 text-warning hover:bg-warning/10"
              onClick={() => navigate('/premium')}
            >
              Upgrade
            </Button>
          </div>
        </div>
      </Card>
    </aside>
  );
};
