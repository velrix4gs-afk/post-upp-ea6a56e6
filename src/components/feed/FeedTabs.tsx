import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Sparkles, Users, TrendingUp } from "lucide-react";

interface FeedTabsProps {
  activeTab: 'for-you' | 'following' | 'trending';
  onTabChange: (tab: 'for-you' | 'following' | 'trending') => void;
}

export const FeedTabs = ({ activeTab, onTabChange }: FeedTabsProps) => {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 90);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tabs = [
    { id: 'for-you' as const, label: 'For You', icon: Sparkles },
    { id: 'following' as const, label: 'Following', icon: Users },
    { id: 'trending' as const, label: 'Trending', icon: TrendingUp },
  ];

  return (
    <div
      data-condensed={condensed}
      className={cn(
        "sticky top-0 header-morph progressive-blur bg-background/95 supports-[backdrop-filter]:bg-background/70 z-30 border-b border-border/40",
        condensed && "border-b-0 w-fit"
      )}
    >
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex-1 relative text-sm font-semibold transition-all duration-200",
                condensed ? "py-2 px-4" : "py-4",
                "hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                <span className={cn(condensed && !isActive && "hidden")}>{tab.label}</span>
              </div>
              
              {/* Active indicator */}
              <div
                className={cn(
                  "absolute bottom-0 left-1/2 -translate-x-1/2 h-1 bg-primary rounded-full transition-all duration-300",
                  isActive ? "w-12 opacity-100" : "w-0 opacity-0"
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
