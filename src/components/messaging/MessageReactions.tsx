import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Reaction {
  type: string;
  count: number;
  users: { id: string; name: string }[];
  hasReacted: boolean;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  onReact: (type: string) => void;
  onUnreact: (type: string) => void;
}

export const MessageReactions = ({ reactions, onReact, onUnreact }: MessageReactionsProps) => {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((reaction) => (
        <Button
          key={reaction.type}
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs rounded-full transition-all hover:scale-105 reaction-float",
            reaction.hasReacted 
              ? "bg-primary/10 border border-primary/20" 
              : "bg-muted border border-transparent"
          )}
          onClick={() => reaction.hasReacted ? onUnreact(reaction.type) : onReact(reaction.type)}
        >
          <span className="mr-1">{reaction.type}</span>
          <span className="text-muted-foreground">{reaction.count}</span>
        </Button>
      ))}
    </div>
  );
};
