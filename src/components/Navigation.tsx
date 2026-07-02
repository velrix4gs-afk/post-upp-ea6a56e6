import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import ThemeToggle from './ThemeToggle';
import { Home, User, Bell, Menu, Search, MessageCircle, Users, Compass, Bookmark, BarChart3, Settings, Star, Crown, BadgeCheck, FileText, Shield } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/hooks/useProfile';
import { useAdmin } from '@/hooks/useAdmin';
import NotificationCenter from './NotificationCenter';
import { MenuPanel } from './MenuPanel';
import { cn } from '@/lib/utils';
const Navigation = () => {
  const {
    user,
    signOut
  } = useAuth();
  const {
    profile
  } = useProfile();
  const {
    unreadCount
  } = useNotifications();
  const {
    isAdmin
  } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastInteraction, setLastInteraction] = useState(Date.now());
  const isActive = (path: string) => location.pathname === path;

  // Hide navigation on auth pages and messages page
  const authPages = ['/auth', '/signin', '/signup', '/forgot-password'];
  const isAuthPage = authPages.some(page => location.pathname.startsWith(page));
  const isMessagesPage = location.pathname === '/messages';
  const isCreatorPage = location.pathname.startsWith('/create');

  // Pages where auto-hide should be enabled
  const isFeedPage = location.pathname === '/feed' || location.pathname === '/';

  // Auto-hide after 3 seconds of no interaction (only on feed pages)
  useEffect(() => {
    if (!isFeedPage) {
      setIsVisible(true);
      return;
    }
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);
    return () => clearTimeout(hideTimer);
  }, [lastInteraction, isFeedPage]);

  // Show nav on any user interaction
  const handleInteraction = useCallback(() => {
    setIsVisible(true);
    setLastInteraction(Date.now());
  }, []);

  // Listen for scroll, touch, and mouse events
  useEffect(() => {
    if (!isFeedPage) return;
    const events = ['scroll', 'touchstart', 'touchmove', 'mousemove', 'click'];
    events.forEach(event => {
      window.addEventListener(event, handleInteraction, {
        passive: true
      });
    });
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
      });
    };
  }, [handleInteraction, isFeedPage]);
  if (isAuthPage || isMessagesPage || isCreatorPage) {
    return null;
  }

  // Compact mode for non-feed pages
  const isHomePage = location.pathname === '/feed' || location.pathname === '/' || location.pathname === '/dashboard';
  const isCompactMode = !isHomePage;
  return <nav style={{
    position: 'static',
    paddingTop: 'env(safe-area-inset-top)'
  }} className={cn("border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60 z-50 transition-all duration-300", isCompactMode ? 'py-1' : 'py-1.5',
  // On feed pages, nav scrolls with page (not sticky). On other pages, it's sticky.
  isFeedPage ? "" : "sticky top-0",
  // Force non-sticky everywhere (requested)
  "static")}>
      <div className="container mx-auto px-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/feed" className={`font-bold text-primary hover:opacity-80 transition-all duration-300 ${isCompactMode ? 'text-lg' : 'text-2xl'}`}>
              POST UP
            </Link>
            
            {user && !isCompactMode && <div className="hidden lg:flex items-center gap-2">
                <Link to="/feed">
                  <Button variant={isActive('/feed') ? 'default' : 'ghost'} size="sm" className="gap-2">
                    <Home className="h-4 w-4" />
                    Feed
                  </Button>
                </Link>
                <Link to="/messages">
                  <Button variant={isActive('/messages') ? 'default' : 'ghost'} size="sm" className="gap-2 relative">
                    <MessageCircle className="h-4 w-4" />
                    Messages
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      3
                    </Badge>
                  </Button>
                </Link>
                <Link to="/friends">
                  <Button variant={isActive('/friends') ? 'default' : 'ghost'} size="sm" className="gap-2">
                    <Users className="h-4 w-4" />
                    Friends
                  </Button>
                </Link>
                <Link to="/explore">
                  <Button variant={isActive('/explore') ? 'default' : 'ghost'} size="sm" className="gap-2">
                    <Compass className="h-4 w-4" />
                    Explore
                  </Button>
                </Link>
                <Link to="/bookmarks">
                  <Button variant={isActive('/bookmarks') ? 'default' : 'ghost'} size="sm" className="gap-2">
                    <Bookmark className="h-4 w-4" />
                    Saved
                  </Button>
                </Link>
                <Link to="/pages">
                  <Button variant={isActive('/pages') ? 'default' : 'ghost'} size="sm" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Pages
                  </Button>
                </Link>
                <Link to="/reels">
                  <Button variant={isActive('/reels') ? 'default' : 'ghost'} size="sm" className="gap-2">
                    <Star className="h-4 w-4" />
                    Reels
                  </Button>
                </Link>
                <Link to="/verification">
                  <Button variant={isActive('/verification') ? 'default' : 'ghost'} size="sm" className="gap-2">
                    <BadgeCheck className="h-4 w-4" />
                    Verify
                  </Button>
                </Link>
                <Link to="/premium">
                  <Button variant={isActive('/premium') ? 'default' : 'ghost'} size="sm" className="gap-2">
                    <Crown className="h-4 w-4" />
                    Premium
                  </Button>
                </Link>
              </div>}
          </div>

          {user && !isCompactMode && <div className="md:hidden flex items-center justify-end ml-[80px]">
              <Button variant="ghost" size="sm" onClick={() => navigate('/search')}>
                <Search className="h-5 w-5" />
              </Button>
            </div>}

          {user && !isCompactMode && <div className="hidden md:flex flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-9 w-full" onClick={() => navigate('/search')} readOnly />
              </div>
            </div>}

          <div className={`flex items-center transition-all duration-300 ${isCompactMode ? 'gap-2' : 'gap-3'}`}>
            <ThemeToggle />
            
            {user ? <>
                <Button variant="ghost" size={isCompactMode ? "icon" : "sm"} className="relative" onClick={() => setShowNotifications(true)}>
                  <Bell className={isCompactMode ? "h-4 w-4" : "h-5 w-5"} />
                  {unreadCount > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {unreadCount}
                    </Badge>}
                </Button>

                <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

                <MenuPanel isOpen={showMenu} onOpenChange={setShowMenu} trigger={<Button variant="ghost" className={`relative rounded-full transition-all duration-300 ${isCompactMode ? 'h-8 w-8' : 'h-10 w-10'}`}>
                      <Avatar className={isCompactMode ? 'h-7 w-7' : ''}>
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback>{profile?.display_name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      {isAdmin && <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">
                          <Shield className="h-3 w-3" />
                        </Badge>}
                    </Button>} />
              </> : <Link to="/auth">
                <Button>Sign In</Button>
              </Link>}
          </div>
        </div>
      </div>
    </nav>;
};
export default Navigation;