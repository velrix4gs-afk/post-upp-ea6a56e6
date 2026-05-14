import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pin, BellOff, CheckCheck, Check, Archive, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ChatListItemProps {
  id: string;
  name: string;
  avatarUrl?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  isOnline?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isGroup?: boolean;
  isSelected?: boolean;
  isOwnLastMessage?: boolean;
  lastMessageStatus?: 'sent' | 'delivered' | 'read';
  onClick: () => void;
  onLongPress?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

const formatChatTime = (iso?: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return '';
  }
};

export const ChatListItem = ({
  id,
  name,
  avatarUrl,
  lastMessage,
  lastMessageAt,
  unreadCount = 0,
  isOnline,
  isPinned,
  isMuted,
  isGroup,
  isSelected,
  isOwnLastMessage,
  lastMessageStatus,
  onClick,
  onLongPress,
  onArchive,
  onDelete,
}: ChatListItemProps) => {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isSwiping = useRef(false);
  const movedRef = useRef(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Close this row's swipe whenever any other row opens, the list scrolls,
  // or a chat is selected. Dispatched from MessagesPage.
  useEffect(() => {
    const close = (e: Event) => {
      const detail = (e as CustomEvent<{ exceptId?: string }>).detail;
      if (detail?.exceptId && detail.exceptId === id) return;
      setSwipeX(0);
    };
    window.addEventListener('chatlist:close-swipes', close as EventListener);
    return () => window.removeEventListener('chatlist:close-swipes', close as EventListener);
  }, [id]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    movedRef.current = false;
    // Don't start long-press while swiped open
    if (onLongPress && swipeX === 0) {
      longPressTimer.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(40);
        onLongPress();
        longPressTimer.current = null;
      }, 500);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      movedRef.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
      if (!isSwiping.current) {
        // Tell every other row to close as soon as this swipe begins
        window.dispatchEvent(
          new CustomEvent('chatlist:close-swipes', { detail: { exceptId: id } })
        );
      }
      isSwiping.current = true;
      setSwipeX(Math.max(dx, -160));
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isSwiping.current) {
      isSwiping.current = false;
      // Snap open (-160) or closed (0)
      if (swipeX < -80) {
        setSwipeX(-160);
      } else {
        setSwipeX(0);
      }
    } else if (!movedRef.current && swipeX !== 0) {
      // Tap on an open row collapses it (handled in handleClick) — no-op here
    }
    startX.current = null;
    startY.current = null;
  };

  const handleClick = () => {
    if (swipeX !== 0) {
      setSwipeX(0);
      return;
    }
    onClick();
  };

  return (
    <div className="relative overflow-hidden">
      {/* Swipe action backdrop */}
      <div className="absolute inset-y-0 right-0 flex items-center gap-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSwipeX(0);
            onArchive?.();
          }}
          className="h-full w-20 bg-muted text-muted-foreground flex flex-col items-center justify-center text-[10px] gap-1 tap-scale"
        >
          <Archive className="h-4 w-4" />
          Archive
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSwipeX(0);
            onDelete?.();
          }}
          className="h-full w-20 bg-destructive text-destructive-foreground flex flex-col items-center justify-center text-[10px] gap-1 tap-scale"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping.current ? 'none' : 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
        className={cn(
          'relative flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none bg-card tap-scale',
          'border-b border-border/30 last:border-b-0',
          isSelected && 'bg-primary/10',
          isPinned && 'bg-muted/20'
        )}
      >
        <div className="relative flex-shrink-0">
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-muted">{name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          {isOnline && !isGroup && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-card" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p
              className={cn(
                'truncate text-[15px] leading-tight',
                unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'
              )}
            >
              {name}
            </p>
            <span
              className={cn(
                'text-[11px] flex-shrink-0',
                unreadCount > 0 ? 'text-success font-semibold' : 'text-muted-foreground'
              )}
            >
              {formatChatTime(lastMessageAt)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {isOwnLastMessage && lastMessageStatus && (
                <span className="flex-shrink-0">
                  {lastMessageStatus === 'read' ? (
                    <CheckCheck className="h-3.5 w-3.5 text-primary" />
                  ) : lastMessageStatus === 'delivered' ? (
                    <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Check className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </span>
              )}
              <p
                className={cn(
                  'text-[13px] truncate leading-tight',
                  unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {lastMessage || (isGroup ? 'Group chat' : 'Tap to chat')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isMuted && <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
              {isPinned && <Pin className="h-3.5 w-3.5 text-muted-foreground rotate-45" />}
              {unreadCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-success text-success-foreground text-[11px] font-bold flex items-center justify-center animate-scale-in">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
