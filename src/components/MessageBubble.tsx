import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { MoreVertical, Edit2, Trash2, Reply, Copy, Star, Forward } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { MessageReactions } from "./messaging/MessageReactions";
import { ReadReceiptIndicator } from "./messaging/ReadReceiptIndicator";
import { ReactionPicker } from "./ReactionPicker";
import { Badge } from "./ui/badge";
import { VerificationBadge } from "./premium/VerificationBadge";

interface MessageBubbleProps {
  id: string;
  content: string;
  sender: {
    username: string;
    display_name: string;
    avatar_url?: string;
    is_verified?: boolean;
  };
  timestamp: string;
  isOwn: boolean;
  mediaUrl?: string;
  mediaType?: string;
  isEdited?: boolean;
  isForwarded?: boolean;
  isStarred?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: Array<{
    type: string;
    count: number;
    users: { id: string; name: string }[];
    hasReacted: boolean;
  }>;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  onReply?: () => void;
  onReact?: (id: string, reaction: string) => void;
  onUnreact?: (id: string, reaction: string) => void;
  onStar?: (id: string) => void;
  onUnstar?: (id: string) => void;
  onForward?: (id: string) => void;
}

export const MessageBubble = ({
  id,
  content,
  sender,
  timestamp,
  isOwn,
  mediaUrl,
  mediaType,
  isEdited = false,
  isForwarded = false,
  isStarred = false,
  status = 'sent',
  reactions = [],
  onEdit,
  onDelete,
  onReply,
  onReact,
  onUnreact,
  onStar,
  onUnstar,
  onForward,
}: MessageBubbleProps) => {
  return (
    <div className={cn(
      "flex gap-2 group mb-1",
      isOwn ? "flex-row-reverse" : "flex-row"
    )}>
      {!isOwn && (
        <div className="flex items-center gap-1 mb-0.5">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={sender.avatar_url} alt={sender.display_name} />
            <AvatarFallback className="bg-[#00a884] text-white text-xs">{sender.display_name[0]}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium flex items-center gap-1">
            {sender.display_name}
            <VerificationBadge isVerified={sender.is_verified} />
          </span>
        </div>
      )}

      <div className={cn(
        "flex flex-col max-w-[75%]",
        isOwn ? "items-end" : "items-start"
      )}>
        {isForwarded && (
          <Badge variant="secondary" className="mb-1 text-[11px] h-5">
            <Forward className="h-3 w-3 mr-1" />
            Forwarded
          </Badge>
        )}

        <div className="flex items-end gap-1 relative group/bubble">
          <div
            className={cn(
              "rounded-lg px-3 py-2 shadow-sm relative min-w-[60px]",
              isOwn
                ? "bg-[#6e3cfd] dark:bg-[#005c4b] text-[#111b21] dark:text-white rounded-tr-none"
                : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-white rounded-tl-none"
            )}
          >
            {isStarred && (
              <Star className="absolute -top-1 -right-1 h-3 w-3 fill-yellow-400 text-yellow-400" />
            )}

            {mediaUrl && (
              <div className="mb-1 -mx-1 -mt-1">
                {mediaType?.startsWith('image/') ? (
                  <img
                    src={mediaUrl}
                    alt="Message attachment"
                    className="rounded-lg max-w-full max-h-64 cursor-pointer hover:opacity-95 active:opacity-90"
                    onClick={() => window.open(mediaUrl, '_blank')}
                  />
                ) : mediaType?.startsWith('audio/') ? (
                  <audio controls src={mediaUrl} className="max-w-full h-10" />
                ) : null}
              </div>
            )}
            {content && (
              <p className="text-[14.2px] leading-[19px] break-words whitespace-pre-wrap pr-12">
                {content}
              </p>
            )}

            {/* WhatsApp-style timestamp and status */}
            <div className={cn(
              "flex items-center gap-1 text-[11px] absolute bottom-1 right-2",
              isOwn ? "text-[#667781] dark:text-[#8696a0]" : "text-[#667781] dark:text-[#8696a0]"
            )}>
              {isEdited && <span>edited</span>}
              <span>{new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
              {isOwn && <ReadReceiptIndicator status={status} isOwn={isOwn} />}
            </div>
          </div>

          {(onEdit || onDelete || onReply || onReact || onStar || onForward) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover/bubble:opacity-100 transition-opacity hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? "end" : "start"} className="min-w-[180px]">
                {onReact && (
                  <div className="p-2 flex items-center gap-1 border-b">
                    <ReactionPicker onReact={(reaction) => onReact(id, reaction)} />
                  </div>
                )}
                {onReply && (
                  <DropdownMenuItem onClick={onReply} className="py-2.5">
                    <Reply className="h-4 w-4 mr-3" />
                    Reply
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(content)} className="py-2.5">
                  <Copy className="h-4 w-4 mr-3" />
                  Copy
                </DropdownMenuItem>
                {onForward && (
                  <DropdownMenuItem onClick={() => onForward(id)} className="py-2.5">
                    <Forward className="h-4 w-4 mr-3" />
                    Forward
                  </DropdownMenuItem>
                )}
                {(onStar || onUnstar) && (
                  <DropdownMenuItem
                    onClick={() => isStarred ? onUnstar?.(id) : onStar?.(id)}
                    className="py-2.5"
                  >
                    <Star className={cn("h-4 w-4 mr-3", isStarred && "fill-yellow-400 text-yellow-400")} />
                    {isStarred ? 'Unstar' : 'Star'}
                  </DropdownMenuItem>
                )}
                {isOwn && onEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onEdit(id, content)} className="py-2.5">
                      <Edit2 className="h-4 w-4 mr-3" />
                      Edit
                    </DropdownMenuItem>
                  </>
                )}
                {isOwn && onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(id)}
                    className="text-destructive focus:text-destructive py-2.5"
                  >
                    <Trash2 className="h-4 w-4 mr-3" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {onReact && onUnreact && reactions.length > 0 && (
          <MessageReactions
            reactions={reactions}
            onReact={(type) => onReact(id, type)}
            onUnreact={(type) => onUnreact(id, type)}
          />
        )}
      </div>
    </div>
  );
};
