import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { formatDistanceToNow } from "date-fns";
import {
  MoreVertical,
  Edit2,
  Trash2,
  Reply,
  Copy,
  Star,
  Forward,
  CheckCheck,
  FileIcon,
  ZoomIn,
  Pin,
  Download,
  Info,
  Languages,
  Clock,
  AlertCircle
} from "lucide-react";
import { ImageViewer } from "./messaging/ImageViewer";
import { ReadReceiptIndicator } from "./messaging/ReadReceiptIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { useMessageReactions } from "@/hooks/useMessageReactions";
import { MessageReactions } from "./messaging/MessageReactions";
import { ReactionPicker } from "./ReactionPicker";
import { toast } from "@/hooks/use-toast";
import { VoiceMessagePlayer } from "./messaging/VoiceMessagePlayer";
import { haptic } from "@/lib/haptics";

const getBubbleColorValue = (color: string): string => {
  const colorMap: Record<string, string> = {
    default: 'hsl(var(--primary))',
    blue: '#3b82f6',
    green: '#10b981',
    purple: '#a855f7',
    pink: '#ec4899',
    orange: '#f97316',
    red: '#ef4444',
    teal: '#14b8a6',
    yellow: '#eab308',
    indigo: '#6366f1',
    'whatsapp-sent': '#d9fdd3', // Light mode
    'whatsapp-sent-dark': '#005c4b', // Dark mode
    'whatsapp-received': '#ffffff', // Light mode
    'whatsapp-received-dark': '#202c33', // Dark mode
  };
  return colorMap[color] || colorMap.default;
};

interface MessageReaction {
  user_id: string;
  reaction_type: string;
}

interface ReplyToMessage {
  id: string;
  content: string;
  sender_name: string;
  media_url?: string;
  media_type?: string;
}

interface EnhancedMessageBubbleProps {
  id: string;
  content: string;
  sender: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  timestamp: string;
  isOwn: boolean;
  isNew?: boolean;
  mediaUrl?: string;
  mediaType?: string;
  isEdited?: boolean;
  isForwarded?: boolean;
  isStarred?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  /** 0-100 while a large media/voice/video upload is still in flight. */
  uploadProgress?: number;
  reactions?: MessageReaction[];
  bubbleColor?: string;
  replyTo?: ReplyToMessage;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string, deleteFor: 'me' | 'everyone') => void;
  onReply?: () => void;
  onReact?: (messageId: string, reaction: string) => void;
  onUnreact?: (messageId: string) => void;
  onStar?: (messageId: string) => void;
  onUnstar?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onSchedule?: () => void;
  onScrollToMessage?: (messageId: string) => void;
}

export const EnhancedMessageBubble = ({
  id,
  content,
  sender,
  timestamp,
  isOwn,
  isNew = false,
  mediaUrl,
  mediaType,
  isEdited = false,
  isForwarded = false,
  isStarred = false,
  status = 'sent',
  uploadProgress,
  reactions: _reactions = [],
  bubbleColor,
  replyTo,
  onEdit,
  onDelete,
  onReply,
  onReact,
  onUnreact,
  onStar,
  onUnstar,
  onForward,
  onSchedule,
  onScrollToMessage,
}: EnhancedMessageBubbleProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteFor, setDeleteFor] = useState<'me' | 'everyone'>('me');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const { reactions, loading: reactionsLoading } = useMessageReactions(id);

  const handleDelete = () => {
    haptic('warning');
    onDelete?.(id, deleteFor);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div
        id={`message-${id}`}
        className={cn(
          "flex gap-2 group mb-2 relative scroll-mt-20 w-full",
          isOwn ? "flex-row-reverse" : "flex-row",
          isNew && isOwn && "animate-message-send",
          isNew && !isOwn && "animate-message-receive"
        )}
      >
        {!isOwn && (
          <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
            <AvatarImage src={sender.avatar_url} alt={sender.display_name} />
            <AvatarFallback className="text-xs bg-muted">{sender.display_name[0]}</AvatarFallback>
          </Avatar>
        )}

        <div className={cn(
          "flex flex-col min-w-0",
          isOwn ? "items-end" : "items-start",
          "max-w-[80%]"
        )}>
          {!isOwn && (
            <span className="text-xs text-muted-foreground mb-1 px-3">
              {sender.display_name}
            </span>
          )}

          <div className={cn("flex items-start gap-1", isOwn ? "flex-row-reverse" : "flex-row")}>
            <div className="relative">
              {isStarred && (
                <div className="absolute -top-2 -right-2 z-10">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                </div>
              )}

              {(() => {
                const isImageOnly = !!mediaUrl &&
                  (mediaType?.startsWith('image') || mediaType === 'image') &&
                  !content && !replyTo && !isForwarded;
                return (
                  <div
                    style={{
                      backgroundColor: isImageOnly
                        ? 'transparent'
                        : isOwn && bubbleColor
                          ? getBubbleColorValue(bubbleColor)
                          : undefined,
                    }}
                    className={cn(
                      isImageOnly
                        ? "p-0 bg-transparent shadow-none"
                        : "rounded-2xl px-3.5 py-2 md:px-4 md:py-2.5 shadow-sm",
                      !isImageOnly && (isOwn
                        ? "bg-[#0a2cf1f0] dark:bg-[#005c4b] text-black dark:text-white rounded-br-[8px]"
                        : "bg-[#ffffff] dark:bg-[#202c33] text-black dark:text-white border border-border/50 rounded-bl-[8px]")
                    )}
                  >
                    {isForwarded && (
                      <div className="text-xs opacity-70 mb-1 flex items-center gap-1">
                        <Forward className="h-3 w-3" />
                        Forwarded
                      </div>
                    )}


                    {/* Reply-to preview */}
                    {replyTo && (
                      <div
                        className={cn(
                          "mb-2 p-2 rounded-lg border-l-4 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                          isOwn
                            ? "bg-black/10 dark:bg-white/10 border-black/30 dark:border-white/30"
                            : "bg-muted/50 border-primary/50"
                        )}
                        onClick={() => onScrollToMessage?.(replyTo.id)}
                      >
                        <div className="text-xs font-semibold mb-0.5 opacity-80">
                          {replyTo.sender_name}
                        </div>
                        <div className="flex items-center gap-2">
                          {replyTo.media_url && (
                            <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                              {replyTo.media_type?.startsWith('image') ? (
                                <img src={replyTo.media_url} alt="" className="w-full h-full object-cover" />
                              ) : replyTo.media_type?.startsWith('video') ? (
                                <div className="w-full h-full bg-muted flex items-center justify-center">
                                  <span className="text-xs">🎥</span>
                                </div>
                              ) : null}
                            </div>
                          )}
                          <div className="text-xs opacity-70 truncate flex-1">
                            {replyTo.content || (replyTo.media_type?.startsWith('image') ? '📷 Photo' : replyTo.media_type?.startsWith('video') ? '🎥 Video' : '📎 Media')}
                          </div>
                        </div>
                      </div>
                    )}

                    {mediaUrl && (
                      <div className={cn("relative group", isImageOnly ? "mb-0" : "mb-2")}>
                        {mediaType?.startsWith('image') || mediaType === 'image' ? (
                          <div className="relative inline-block">
                            <img
                              src={mediaUrl}
                              alt="Message attachment"
                              className={cn(
                                "w-[min(76vw,320px)] max-h-[340px] object-cover cursor-pointer hover:opacity-95 transition",
                                isImageOnly ? "rounded-[18px]" : "rounded-2xl"
                              )}
                              onClick={() => setShowImageViewer(true)}
                            />
                            {isImageOnly && (
                              <div className="absolute bottom-1.5 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-card/85 text-card-foreground text-[11px] backdrop-blur-sm">
                                <span>
                                  {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <ReadReceiptIndicator status={status} isOwn={isOwn} />
                              </div>
                            )}
                          </div>
                        ) : mediaType?.startsWith('video') || mediaType === 'video' ? (
                          <video
                            controls
                            src={mediaUrl}
                            className="rounded-2xl w-[min(76vw,320px)] max-h-[340px] bg-muted"
                          />
                        ) : mediaType?.startsWith('audio') || mediaType === 'audio' ? (
                          <VoiceMessagePlayer audioUrl={mediaUrl} isOwn={isOwn} />
                        ) : (
                          <a
                            href={mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded bg-muted/50 hover:bg-muted transition"
                          >
                            <FileIcon className="h-5 w-5" />
                            <span className="text-sm truncate">{content || 'Document'}</span>
                          </a>
                        )}
                      </div>
                    )}

                    {content && (
                      <p className="text-[15px] break-words whitespace-pre-wrap leading-relaxed">
                        {content}
                        {isEdited && (
                          <span className="text-[11px] opacity-60 ml-1.5">(edited)</span>
                        )}
                      </p>
                    )}

                    {/* Timestamp and read receipt — hidden when image-only (overlaid on image instead) */}
                    {!isImageOnly && (
                      <div className="flex justify-end items-center gap-1 mt-1">
                        <span className="text-[11px] opacity-70">
                          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <ReadReceiptIndicator status={status} isOwn={isOwn} />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Reactions display using MessageReactions component */}
              {!reactionsLoading && reactions.length > 0 && (
                <MessageReactions
                  reactions={reactions}
                  onReact={(type) => onReact?.(id, type)}
                  onUnreact={(type) => onUnreact?.(id)}
                />
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onReact && (
                <ReactionPicker onReact={(reaction) => onReact(id, reaction)} />
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 md:h-7 md:w-7"
                  >
                    <MoreVertical className="h-3 w-3 md:h-4 md:w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isOwn ? "end" : "start"} className="w-56">
                  {onReply && (
                    <DropdownMenuItem onClick={onReply}>
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(content)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Text
                  </DropdownMenuItem>

                  {onForward && (
                    <DropdownMenuItem onClick={() => onForward(id)}>
                      <Forward className="h-4 w-4 mr-2" />
                      Forward
                    </DropdownMenuItem>
                  )}

                  {(onStar || onUnstar) && (
                    <DropdownMenuItem onClick={() => isStarred ? onUnstar?.(id) : onStar?.(id)}>
                      <Star className={cn("h-4 w-4 mr-2", isStarred && "fill-yellow-400 text-yellow-400")} />
                      {isStarred ? 'Unstar' : 'Star'}
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem onClick={() => {
                    toast({
                      title: 'Pin Message',
                      description: 'This feature will be available soon',
                    });
                  }}>
                    <Pin className="h-4 w-4 mr-2" />
                    Pin Message
                  </DropdownMenuItem>

                  {(mediaUrl && mediaType === 'image') && (
                    <DropdownMenuItem onClick={() => {
                      const link = document.createElement('a');
                      link.href = mediaUrl;
                      link.download = 'image.jpg';
                      link.click();
                    }}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => {
                    const date = new Date(timestamp);
                    toast({
                      title: 'Message Info',
                      description: `Sent: ${date.toLocaleString()}\nStatus: ${status || 'delivered'}`,
                    });
                  }}>
                    <Info className="h-4 w-4 mr-2" />
                    Message Info
                  </DropdownMenuItem>

                  {!isOwn && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => {
                        toast({
                          title: 'Report Message',
                          description: 'Report feature coming soon',
                        });
                      }} className="text-destructive focus:text-destructive">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Report Message
                      </DropdownMenuItem>
                    </>
                  )}

                  {isOwn && onEdit && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onEdit(id, content)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Message
                      </DropdownMenuItem>
                    </>
                  )}

                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setDeleteFor('me');
                          setShowDeleteDialog(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete for me
                      </DropdownMenuItem>

                      {isOwn && (
                        <DropdownMenuItem
                          onClick={() => {
                            setDeleteFor('everyone');
                            setShowDeleteDialog(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete for everyone
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <span className="sr-only text-xs text-muted-foreground mt-1 px-2 md:px-3">
            {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFor === 'everyone'
                ? 'This message will be deleted for everyone in this chat.'
                : 'This message will be deleted for you only.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Viewer */}
      {mediaUrl && (mediaType?.startsWith('image') || mediaType === 'image') && (
        <ImageViewer
          open={showImageViewer}
          onOpenChange={setShowImageViewer}
          imageUrl={mediaUrl}
          onReply={onReply}
          onForward={() => onForward?.(id)}
          onStar={() => isStarred ? onUnstar?.(id) : onStar?.(id)}
          isStarred={isStarred}
        />
      )}
    </>
  );
};
