import { useRef, useState } from 'react';
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
  AlertCircle,
  Phone,
  PhoneMissed,
  Video,
  Image as ImageIcon,
  VideoOff,
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
import { formatCallRecord, parseCallRecord } from "@/lib/callRecord";
import { parseShowcaseReply } from "@/lib/showcaseReply";
import { parseContactShare } from "@/lib/contactShare";
import { profilePathFor } from "@/lib/profilePath";
import { ensurePrivateChat } from "@/lib/chatCreation";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getBubbleColorValue, getBubbleTextColor } from "@/lib/chatTheme";
import DepthCarousel from "@/components/flair/DepthCarousel";

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

function PhoneIconIndicator({ missed }: { missed: boolean }) {
  return missed ? <PhoneMissed className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />;
}

function VideoIconIndicator({ missed }: { missed: boolean }) {
  return missed ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />;
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
  /** Set when several images were sent together as one message. */
  mediaUrls?: string[];
  isEdited?: boolean;
  isForwarded?: boolean;
  isStarred?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  /** Bubble grouping: first/last message of a same-sender run. */
  isFirstOfGroup?: boolean;
  isLastOfGroup?: boolean;
  /**
   * Whether to reserve the avatar column for incoming messages. Only a group
   * chat needs it — in a 1:1 thread the sender is obvious, and showing a
   * circle beside every message is noise (WhatsApp does not).
   */
  showSenderAvatar?: boolean;
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
  mediaUrls,
  isEdited = false,
  isForwarded = false,
  isStarred = false,
  status = 'sent',
  isFirstOfGroup = true,
  isLastOfGroup = true,
  showSenderAvatar = true,
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
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteFor, setDeleteFor] = useState<'me' | 'everyone'>('me');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [activeMultiIndex, setActiveMultiIndex] = useState(0);
  const isMultiImage = !!mediaUrls && mediaUrls.length > 1;
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeFiredRef = useRef(false);
  const { reactions, loading: reactionsLoading } = useMessageReactions(id);

  const SWIPE_TRIGGER = 64;

  const onSwipeStart = (e: React.TouchEvent) => {
    if (!onReply) return;
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
    swipeFiredRef.current = false;
  };

  const onSwipeMove = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    if (!start || !onReply) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx <= 0) {
      setSwipeX(0);
      return;
    }
    setSwiping(true);
    const damped = Math.min(88, dx * 0.6);
    setSwipeX(damped);
    if (damped >= SWIPE_TRIGGER && !swipeFiredRef.current) {
      swipeFiredRef.current = true;
      haptic('light');
    }
  };

  const onSwipeEnd = () => {
    if (swipeFiredRef.current) {
      onReply?.();
    }
    swipeStartRef.current = null;
    swipeFiredRef.current = false;
    setSwiping(false);
    setSwipeX(0);
  };

  const handleDelete = () => {
    haptic('warning');
    onDelete?.(id, deleteFor);
    setShowDeleteDialog(false);
  };

  // Call-log messages (missed/declined/completed calls) get a compact,
  // centered row instead of the normal chat bubble — matching how
  // WhatsApp shows call history inline in the thread.
  // Defensively detect call records even when media_type isn't 'call'
  // (some legacy/migrated messages can have null media_type but JSON
  // content shaped like {"kind":"voice","status":"..."}); without this,
  // the raw JSON would leak through as a text message.
  const showcaseReply = parseShowcaseReply(content);
  const contactShare = parseContactShare(content);
  const bodyText = showcaseReply ? showcaseReply.text : contactShare ? '' : content;
  const contentLooksLikeCallRecord = (() => {
    if (typeof content !== 'string') return false;
    const trimmed = content.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
    try { const p = JSON.parse(trimmed); return 'kind' in p && 'status' in p; } catch { return false; }
  })();
  if (mediaType === 'call' || contentLooksLikeCallRecord) {
    const callInfo = parseCallRecord(content) ?? { kind: 'voice' as const, status: 'unknown' as const };
    const isVideo = callInfo.kind === 'video';
    const isMissedForMe = !isOwn && callInfo.status === 'missed';
    const label = formatCallRecord(callInfo, { isOwn, includeDirection: true });
    return (
      <div className="flex justify-center my-2">
        <div
          className={cn(
            'flex items-center gap-2 px-3.5 py-2 rounded-full text-xs',
            isMissedForMe
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isVideo ? <VideoIconIndicator missed={isMissedForMe} /> : <PhoneIconIndicator missed={isMissedForMe} />}
          <span>{label}</span>
          <span className="opacity-60">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        id={`message-${id}`}
        onTouchStart={onSwipeStart}
        onTouchMove={onSwipeMove}
        onTouchEnd={onSwipeEnd}
        onTouchCancel={onSwipeEnd}
        style={swipeX ? { transform: `translateX(${swipeX}px)` } : undefined}
        className={cn(
          "msg-row flex gap-2 group relative scroll-mt-20 w-full",
          isLastOfGroup ? "mb-2" : "mb-0.5",
          swiping && "msg-dragging",
          isOwn ? "flex-row-reverse" : "flex-row",
          isNew && isOwn && "animate-message-send",
          isNew && !isOwn && "animate-message-receive"
        )}
      >
        {/* Swipe-to-reply affordance */}
        {swipeX > 0 && (
          <span
            className="swipe-reply-hint absolute left-0 top-1/2 -translate-y-1/2 -ml-8 text-muted-foreground"
            style={{ opacity: Math.min(1, swipeX / SWIPE_TRIGGER) }}
          >
            <Reply className="h-4 w-4" />
          </span>
        )}

        {/* Slide-to-see-time peek */}
        <span className="msg-peek-time">
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        {!isOwn && showSenderAvatar && (
          isFirstOfGroup ? (
            <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
              <AvatarImage src={sender.avatar_url} alt={sender.display_name} />
              <AvatarFallback className="text-xs bg-muted">{sender.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-8 w-8 flex-shrink-0" aria-hidden="true" />
          )
        )}

        <div className={cn(
          "flex flex-col min-w-0",
          isOwn ? "items-end" : "items-start",
          "w-fit max-w-[80%]"
        )}>
          {!isOwn && isFirstOfGroup && (
            <span className="text-xs text-muted-foreground mb-1 px-3">
              {sender.display_name}
            </span>
          )}

          <div className={cn("flex items-start gap-1", isOwn ? "flex-row-reverse" : "flex-row")}>
            <div className="relative min-w-0 max-w-full">
              {isStarred && (
                <div className="absolute -top-2 -right-2 z-10">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                </div>
              )}

              {(() => {
                const isImageOnly = (isMultiImage || (!!mediaUrl &&
                  (mediaType?.startsWith('image') || mediaType === 'image'))) &&
                  !content && !replyTo && !isForwarded;
                const customBg = isOwn && bubbleColor ? getBubbleColorValue(bubbleColor) : undefined;
                return (
                  <div
                    style={{
                      backgroundColor: isImageOnly ? 'transparent' : customBg,
                      color: !isImageOnly && customBg ? getBubbleTextColor(bubbleColor) : undefined,
                    }}
                    data-first-of-group={isFirstOfGroup}
                    data-last-of-group={isLastOfGroup}
                    className={cn(
                      "msg-bubble",
                      "transition-[background-color,color] duration-300 ease-out",
                      isImageOnly
                        ? "p-0 bg-transparent shadow-none"
                        : cn("bubble-squircle px-3.5 py-[7px] md:px-4 md:py-2 shadow-sm", (mediaType?.startsWith("audio") || mediaType === "audio") ? "rounded-[28px]" : "rounded-[18px]"),
                      // True WhatsApp palette — light mode sent bubbles are
                      // pale green (#d9fdd3), not blue; dark mode already
                      // matched WhatsApp's actual dark colors.
                      !isImageOnly && !customBg && (isOwn
                        ? "bg-[#8e24d6] dark:bg-[#9500bb] text-white"
                        : "bg-white dark:bg-[#202c33] text-black dark:text-white border border-black/5 dark:border-white/5"),
                      typeof uploadProgress === 'number' && uploadProgress < 100 && "relative overflow-hidden"
                    )}
                  >


                    {/* Delivery progress for large media / voice / video */}
                    {typeof uploadProgress === 'number' && uploadProgress < 100 && (
                      <>
                        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/10 dark:bg-white/10">
                          <div
                            className="h-full bg-primary transition-[width] duration-200 ease-out"
                            style={{ width: `${Math.max(4, uploadProgress)}%` }}
                          />
                        </div>
                        <div className="absolute top-1 right-1.5 text-[10px] font-medium px-1.5 py-[1px] rounded-full bg-black/35 text-white">
                          {Math.round(uploadProgress)}%
                        </div>
                      </>
                    )}
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

                    {isMultiImage && (
                      <div className={cn("relative group", isNew && "media-drop", isImageOnly ? "mb-0" : "mb-2")}>
                        <div
                          className="relative w-[min(76vw,320px)] h-[220px] overflow-hidden rounded-[18px] bg-black"
                          onClick={() => setShowImageViewer(true)}
                        >
                          <DepthCarousel
                            items={mediaUrls!.map((url, i) => ({ image: url, alt: `Photo ${i + 1}` }))}
                            cardWidth={160}
                            cardHeight={200}
                            radius={14}
                            tint="#000000"
                            depth={110}
                            spread={48}
                            tilt={14}
                            visibleCards={3}
                            falloff={0.25}
                            blur={4}
                            showControls
                            showIndicators={mediaUrls!.length <= 8}
                            onChange={(idx) => setActiveMultiIndex(idx)}
                          />
                        </div>
                        {isImageOnly && (
                          <div className="absolute bottom-1.5 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-card/85 text-card-foreground text-[11px] backdrop-blur-sm">
                            <span>
                              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <ReadReceiptIndicator status={status} isOwn={isOwn} />
                          </div>
                        )}
                      </div>
                    )}

                    {!isMultiImage && mediaUrl && (
                      <div className={cn("relative group", isNew && "media-drop", isImageOnly ? "mb-0" : "mb-2")}>
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
                          <VoiceMessagePlayer audioUrl={mediaUrl} isOwn={isOwn} avatarUrl={showSenderAvatar ? sender.avatar_url : undefined} fallbackName={showSenderAvatar ? (sender.display_name || sender.username) : undefined} />
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

                    {showcaseReply && (
                      <div className="mb-1.5 flex items-stretch overflow-hidden rounded-xl bg-black/15 dark:bg-white/10">
                        <div className="w-1 flex-shrink-0 bg-white/80 dark:bg-white/70" />
                        <div className="min-w-0 flex-1 px-2.5 py-2">
                          <p className="truncate text-[13px] font-semibold">
                            {isOwn ? (showcaseReply.ownerName || 'Showcase') : 'You'} · Showcase
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[13px] opacity-80">
                            {showcaseReply.mediaType === 'video' ? <Video className="h-3.5 w-3.5 flex-shrink-0" /> : <ImageIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                            <span className="line-clamp-2">{showcaseReply.caption || (showcaseReply.mediaType === 'video' ? 'Video' : 'Photo')}</span>
                          </p>
                        </div>
                        {showcaseReply.mediaUrl && (
                          <div className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden bg-black/30">
                            {showcaseReply.mediaType === 'video' ? (
                              <video src={`${showcaseReply.mediaUrl}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                            ) : (
                              <img src={showcaseReply.mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {contactShare && (
                      <div className="-mx-1 -mt-0.5 mb-1 min-w-[250px]">
                        {contactShare.contacts.map((c) => (
                          <div key={c.id} className="flex items-center gap-3 px-1 py-1.5">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={c.avatar_url || undefined} />
                              <AvatarFallback>{(c.display_name || c.username || '?').charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-semibold">{c.display_name || c.username}</p>
                              <p className="truncate text-[13px] opacity-75">@{c.username}</p>
                            </div>
                          </div>
                        ))}
                        <div className="mt-1 flex border-t border-current/20 text-[14px] font-medium">
                          <button
                            className="flex-1 py-2.5 active:opacity-60"
                            onClick={() => navigate(profilePathFor(contactShare.contacts[0].id, contactShare.contacts[0].username))}
                          >
                            View profile
                          </button>
                          {contactShare.contacts.length === 1 && contactShare.contacts[0].id !== currentUser?.id && (
                            <>
                              <div className="w-px bg-current/20" />
                              <button
                                className="flex-1 py-2.5 active:opacity-60"
                                onClick={async () => {
                                  if (!currentUser) return;
                                  try {
                                    const chatId = await ensurePrivateChat(currentUser.id, contactShare.contacts[0].id);
                                    navigate(`/messages?chat=${chatId}`);
                                  } catch { /* ignore */ }
                                }}
                              >
                                Message
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {bodyText && (
                      <p className="max-w-full text-[15px] whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
                        {bodyText}
                        {isEdited && (
                          <span className="text-[11px] opacity-60 ml-1.5">(edited)</span>
                        )}
                        {/* Inline timestamp: floats right on the last line when it fits, wraps under otherwise */}
                        {!mediaUrl && (
                          <span className="float-right ml-3 mt-[7px] inline-flex items-center gap-1 text-[11px] leading-none opacity-70 select-none">
                            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            <ReadReceiptIndicator status={status} isOwn={isOwn} />
                          </span>
                        )}
                      </p>
                    )}

                    {/* Timestamp and read receipt — hidden when image-only (overlaid on image) or when shown inline with text */}
                    {!isImageOnly && !(bodyText && !mediaUrl) && (
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
      {(isMultiImage || (mediaUrl && (mediaType?.startsWith('image') || mediaType === 'image'))) && (
        <ImageViewer
          open={showImageViewer}
          onOpenChange={setShowImageViewer}
          imageUrl={isMultiImage ? mediaUrls![activeMultiIndex] : mediaUrl!}
          onReply={onReply}
          onForward={() => onForward?.(id)}
          onStar={() => isStarred ? onUnstar?.(id) : onStar?.(id)}
          isStarred={isStarred}
        />
      )}
    </>
  );
};