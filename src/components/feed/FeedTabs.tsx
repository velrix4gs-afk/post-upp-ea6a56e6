import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Plus, Sparkles, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedCreateMenu } from "@/components/feed/FeedCreateMenu";

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
      <div className="flex items-center">
        <div className="flex min-w-0 flex-1">
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
        <FeedCreateMenu
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mr-2 h-10 w-10 shrink-0 rounded-full transition-transform duration-200 hover:bg-primary/10 hover:text-primary active:scale-90"
              aria-label="Create a post or story"
              title="Create"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </Button>
          }
        />
      </div>
    </div>
  );
};
