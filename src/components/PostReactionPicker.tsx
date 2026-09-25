import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { REACTION_EMOJIS, ReactionType } from '@/hooks/useReactions';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostReactionPickerProps {
  currentReaction: ReactionType | null;
  onReactionSelect: (type: ReactionType) => void;
  reactionCounts: Record<ReactionType, number>;
}

export const PostReactionPicker = ({ currentReaction, onReactionSelect, reactionCounts }: PostReactionPickerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2 hover:bg-pink-500/10 hover:text-pink-500 group",
            currentReaction && "text-pink-500"
          )}
        >
          {currentReaction ? (
            <span key={currentReaction} className="reaction-float text-lg">
              {REACTION_EMOJIS[currentReaction]}
            </span>
          ) : (
            <Heart className={cn(
              "h-[18px] w-[18px]",
              currentReaction && "fill-current"
            )} />
          )}
          <span className="text-sm">
            {Object.values(reactionCounts).reduce((sum, count) => sum + count, 0) || ''}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-1">
          {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map((type) => (
            <Button
              key={type}
              variant="ghost"
              size="sm"
              className={cn(
                "h-12 w-12 text-2xl hover:scale-125 transition-transform p-0",
                currentReaction === type && "bg-muted"
              )}
              onClick={() => onReactionSelect(type)}
            >
              <span className="relative">
                {REACTION_EMOJIS[type]}
                {reactionCounts[type] > 0 && (
                  <span className="absolute -bottom-1 -right-1 text-[10px] bg-background rounded-full px-1 border">
                    {reactionCounts[type]}
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
