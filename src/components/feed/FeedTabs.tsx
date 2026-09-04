import { cn } from "@/lib/utils";
import { Sparkles, Users, TrendingUp } from "lucide-react";

interface FeedTabsProps {
  activeTab: 'for-you' | 'following' | 'trending';
  onTabChange: (tab: 'for-you' | 'following' | 'trending') => void;
}

export const FeedTabs = ({ activeTab, onTabChange }: FeedTabsProps) => {
  const tabs = [
    { id: 'for-you' as const, label: 'For You', icon: Sparkles },
    { id: 'following' as const, label: 'Following', icon: Users },
    { id: 'trending' as const, label: 'Trending', icon: TrendingUp },
  ];

  return (
    <div className="sticky top-0 progressive-blur bg-background/95 supports-[backdrop-filter]:bg-background/70 z-30 border-b border-border/40">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex-1 relative py-4 text-sm font-semibold transition-all duration-200",
                "hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                <span>{tab.label}</span>
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
