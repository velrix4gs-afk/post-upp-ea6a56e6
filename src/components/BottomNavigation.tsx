import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Home, Film, Plus, Search, User } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import CreatePostSimple from './CreatePostSimple';
import { cn } from '@/lib/utils';

// Lazy module preloaders for instant route switches on hover/touch
const ROUTE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  '/search': () => import('@/pages/SearchPage'),
  '/reels': () => import('@/pages/ReelsPage'),
  '/feed': () => import('@/pages/Feed'),
};
const preloadRoute = (path: string) => {
  const key = Object.keys(ROUTE_PRELOADERS).find((k) => path.startsWith(k));
  if (key) ROUTE_PRELOADERS[key]().catch(() => {});
};

export const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastInteraction, setLastInteraction] = useState(Date.now());

  // Pages where bottom nav should be shown - ONLY feed and reels
  const allowedPages = ['/feed', '/', '/reels'];
  const isAllowedPage = allowedPages.some(page => 
    location.pathname === page || location.pathname.startsWith('/feed')
  );

  // Hide bottom nav on auth pages or non-allowed pages
  const authPages = ['/auth', '/signin', '/signup', '/forgot-password'];
  const isAuthPage = authPages.some(page => location.pathname.startsWith(page));

  // Auto-hide after 3 seconds of no interaction
  useEffect(() => {
    if (!isAllowedPage) return;

    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(hideTimer);
  }, [lastInteraction, isAllowedPage]);

  // Show nav on any user interaction
  const handleInteraction = useCallback(() => {
    setIsVisible(true);
    setLastInteraction(Date.now());
  }, []);

  // Listen for scroll, touch, and mouse events
  useEffect(() => {
    if (!isAllowedPage) return;

    const events = ['scroll', 'touchstart', 'touchmove', 'mousemove', 'click'];
    events.forEach(event => {
      window.addEventListener(event, handleInteraction, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
      });
    };
  }, [handleInteraction, isAllowedPage]);

  // Don't render if not authenticated, on auth page, or not on allowed pages
  if (!user || isAuthPage || !isAllowedPage) {
    return null;
  }

  const isActive = (path: string) => location.pathname === path;

  // Instagram-like bottom nav: Home, Search, Reels, Profile
  const navItems = [
    {
      label: 'Home',
      icon: Home,
      path: '/feed',
      isActive: isActive('/feed') || location.pathname === '/'
    },
    {
      label: 'Search',
      icon: Search,
      path: '/search',
      isActive: isActive('/search')
    },
    {
      label: 'Create',
      icon: Plus,
      action: () => setShowCreatePost(true),
      isCenter: true
    },
    {
      label: 'Reels',
      icon: Film,
      path: '/reels',
      isActive: isActive('/reels')
    },
    {
      label: 'Profile',
      icon: User,
      path: `/profile/${user?.id}`,
      isActive: location.pathname.startsWith('/profile')
    }
  ];

  return (
    <>
      <nav
        className={cn(
          "md:hidden fixed left-0 right-0 mx-3 z-50 transition-all duration-300 ease-in-out rounded-2xl bg-background/80 backdrop-blur-lg border border-border/30",
          isVisible 
            ? "opacity-100 translate-y-0" 
            : "opacity-0 translate-y-4 pointer-events-none"
        )}
        style={{ bottom: 'calc(5px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActiveTab = item.isActive;

            if (item.isCenter) {
              return (
                <button
                  key={index}
                  onClick={() => {
                    handleInteraction();
                    item.action?.();
                  }}
                  className="flex flex-col items-center gap-0.5 tap-scale"
                >
                  <div className="h-10 w-10 rounded-full bg-primary shadow-lg flex items-center justify-center hover:scale-110 active:scale-90 transition-all duration-200">
                    <Icon className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Create</span>
                </button>
              );
            }

            return (
              <button
                key={index}
                onClick={() => {
                  handleInteraction();
                  if (item.action) {
                    item.action();
                  } else if (item.path) {
                    navigate(item.path);
                  }
                }}
                onMouseEnter={() => item.path && preloadRoute(item.path)}
                onTouchStart={() => item.path && preloadRoute(item.path)}
                className="flex flex-col items-center gap-0.5 transition-all duration-200 tap-scale"
              >
                <div
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200",
                    isActiveTab
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-all duration-200",
                      isActiveTab ? "stroke-[2.5px]" : "stroke-[2px]"
                    )}
                  />
                  <span className="text-[10px]">{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Create Post Drawer (Bottom Sheet) */}
      <Drawer open={showCreatePost} onOpenChange={setShowCreatePost}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b border-border/50">
            <DrawerTitle className="text-center">Create Post</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto">
            <CreatePostSimple onSuccess={() => setShowCreatePost(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
