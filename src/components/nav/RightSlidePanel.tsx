import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNotifications } from "@/hooks/useNotifications";
import {
  Home, Film, MessageCircle, Users, Bookmark, Settings, User, Search,
  Bell, FileText, LogOut, X, Plus, Sparkles, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";

// Mirrors BottomNavigation's hover preloaders so route switches feel instant.
const ROUTE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  "/search": () => import("@/pages/SearchPage"),
  "/reels": () => import("@/pages/ReelsPage"),
  "/feed": () => import("@/pages/Feed"),
  "/messages": () => import("@/pages/MessagesPage"),
  "/friends": () => import("@/pages/FriendsPage"),
  "/bookmarks": () => import("@/pages/BookmarksPage"),
  "/pages": () => import("@/pages/PagesPage"),
  "/settings": () => import("@/pages/SettingsPage"),
  "/explore": () => import("@/pages/ExplorePage"),
};
const preloadRoute = (path: string) => {
  const key = Object.keys(ROUTE_PRELOADERS).find((k) => path.startsWith(k));
  if (key) ROUTE_PRELOADERS[key]().catch(() => { });
};

const HIDDEN_ROUTES = ["/auth", "/signin", "/signup", "/forgot-password", "/reset-password", "/create"];

export const RightSlidePanel = () => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const isHidden = HIDDEN_ROUTES.some((p) => pathname.startsWith(p));

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 240);
  }, []);

  // Close on route change
  useEffect(() => { if (open) close(); /* eslint-disable-next-line */ }, [pathname]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Edge-swipe from right opens panel (mobile gesture)
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? 0;
      if (x > window.innerWidth - 24) touchStartX.current = x;
      else touchStartX.current = null;
    };
    const onEnd = (e: TouchEvent) => {
      if (touchStartX.current == null) return;
      const endX = e.changedTouches[0]?.clientX ?? 0;
      if (touchStartX.current - endX > 60) setOpen(true);
      touchStartX.current = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  if (!user || isHidden) return null;

  const initials = (profile?.display_name || user.email || "U").slice(0, 2).toUpperCase();

  const nav: Array<{ label: string; icon: any; path?: string; action?: () => void; badge?: number }> = [
    { label: "Home", icon: Home, path: "/feed" },
    { label: "Reels", icon: Film, path: "/reels" },
    { label: "Messages", icon: MessageCircle, path: "/messages" },
    { label: "Friends", icon: Users, path: "/friends" },
    { label: "Notifications", icon: Bell, path: "/feed", badge: unreadCount },
    { label: "Search", icon: Search, path: "/search" },
    { label: "Explore", icon: Sparkles, path: "/explore" },
    { label: "Pages", icon: FileText, path: "/pages" },
    { label: "Bookmarks", icon: Bookmark, path: "/bookmarks" },
    { label: "Profile", icon: User, path: `/profile/${user.id}` },
    { label: "Settings", icon: Settings, path: "/settings" },
  ];

  return (
    <>
      {/* Floating opener — visible on every page when authenticated */}
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-3 top-3 z-40 h-10 w-10 rounded-full",
          "fb-depth-1 fb-press flex items-center justify-center",
          "md:hidden"
        )}
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={profile?.avatar_url || undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </button>
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="hidden md:flex fixed right-4 top-4 z-40 h-10 w-10 rounded-full fb-depth-1 fb-press items-center justify-center"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex justify-end"
          onClick={close}
        >
          {/* Scrim */}
          <div
            className={cn(
              "absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200",
              closing ? "opacity-0" : "opacity-100"
            )}
          />
          {/* Panel */}
          <div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative h-full w-[86%] max-w-[360px] fb-depth-2",
              "flex flex-col text-foreground",
              closing ? "fb-panel-out" : "fb-panel-in"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
              <button
                onClick={() => navigate(`/profile/${user.id}`)}
                className="flex items-center gap-3 fb-press"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <div className="font-semibold leading-tight">
                    {profile?.display_name || "Profile"}
                  </div>
                  <div className="text-xs text-muted-foreground">View profile</div>
                </div>
              </button>
              <button
                aria-label="Close menu"
                onClick={close}
                className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center fb-press touch-manipulation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav list */}
            <div className="flex-1 overflow-y-auto py-2">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = item.path && pathname === item.path;
                return (
                  <button
                    key={item.label}
                    onMouseEnter={() => item.path && preloadRoute(item.path)}
                    onTouchStart={() => item.path && preloadRoute(item.path)}
                    onClick={() => {
                      if (item.action) item.action();
                      else if (item.path) navigate(item.path);
                      close();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 fb-press",
                      "hover:bg-secondary/70 transition-colors",
                      active && "bg-primary/10 text-primary"
                    )}
                  >
                    <span
                      className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center",
                        active ? "bg-primary text-primary-foreground" : "bg-secondary"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 text-left font-medium">{item.label}</span>
                    {item.badge ? (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-border/50 p-3 flex items-center justify-between gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { signOut(); close(); }}
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RightSlidePanel;