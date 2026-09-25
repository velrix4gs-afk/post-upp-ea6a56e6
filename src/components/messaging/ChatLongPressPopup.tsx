import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCheck, Pin, PinOff, Bell, BellOff, Trash2, X, Image as ImageIcon, Video, Mic, FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { isChatMuted, useChatSettings } from '@/hooks/useChatSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface ChatLongPressPopupProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
  name: string;
  avatarUrl?: string;
  lastMessage?: string;
  statusText?: string;
  unreadCount?: number;
  onMarkUnread?: () => void;
  onDelete?: () => void;
}

interface PreviewMsg {
  id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  sender_id: string;
  created_at: string;
}

type RowProps = {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
};

const Row = ({ icon, label, danger, onClick }: RowProps) => (
  <button
    type="button"
    onClick={() => {
      haptic('light');
      onClick();
    }}
    className={cn(
      'w-full h-14 px-4 flex items-center gap-4 text-left text-[16px] touch-manipulation',
      'hover:bg-muted/60 active:bg-muted transition-colors',
      danger && 'text-destructive'
    )}
  >
    <span className="h-6 w-6 flex items-center justify-center flex-shrink-0">{icon}</span>
    <span className="font-medium">{label}</span>
  </button>
);

const getMediaLabel = (message: PreviewMsg) => {
  if (message.content) return message.content;
  if (message.media_type?.startsWith('image')) return 'Image';
  if (message.media_type?.startsWith('video')) return 'Video';
  if (message.media_type?.startsWith('audio')) return 'Voice message';
  if (message.media_url) return 'Attachment';
  return '';
};

const getMediaIcon = (message: PreviewMsg) => {
  if (message.media_type?.startsWith('image')) return <ImageIcon className="h-4 w-4" />;
  if (message.media_type?.startsWith('video')) return <Video className="h-4 w-4" />;
  if (message.media_type?.startsWith('audio')) return <Mic className="h-4 w-4" />;
  if (message.media_url) return <FileIcon className="h-4 w-4" />;
  return null;
};

/**
 * Centered floating popup shown on long-press of a chat row.
 * Telegram/WhatsApp-iOS style: blurred backdrop, quick actions card.
 */
export const ChatLongPressPopup = ({
  open,
  onClose,
  chatId,
  name,
  avatarUrl,
  statusText = 'last seen recently',
  unreadCount = 0,
  onMarkUnread,
  onDelete,
}: ChatLongPressPopupProps) => {
  const { user } = useAuth();
  const { settings, togglePin, toggleMute } = useChatSettings(chatId);
  const [messages, setMessages] = useState<PreviewMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const isPinned = !!settings?.is_pinned;
  const isMuted = isChatMuted(settings);

  useEffect(() => {
    if (!open || !chatId) return;
    let cancelled = false;
    setLoading(true);
    haptic('medium');

    (async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, media_url, media_type, sender_id, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(24);

      if (cancelled) return;
      if (!error) setMessages(((data as PreviewMsg[]) || []).reverse());
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, chatId]);

  const previewItems = useMemo(() => {
    const items: Array<{ type: 'date'; key: string; date: string } | { type: 'message'; key: string; message: PreviewMsg }> = [];
    let lastDate = '';
    messages.forEach((message) => {
      const dateKey = new Date(message.created_at).toDateString();
      if (dateKey !== lastDate) {
        items.push({ type: 'date', key: `date-${dateKey}`, date: message.created_at });
        lastDate = dateKey;
      }
      items.push({ type: 'message', key: message.id, message });
    });
    return items;
  }, [messages]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/70 backdrop-blur-2xl p-3 touch-manipulation"
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-[480px] max-h-[92dvh] flex flex-col gap-3 animate-scale-in"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="rounded-[1.35rem] overflow-hidden border border-border/50 bg-card shadow-2xl min-h-0 flex flex-col">
          <div className="h-16 px-4 flex items-center gap-3 bg-gradient-to-b from-card to-card/95 border-b border-border/40 flex-shrink-0">
            <Avatar className="h-12 w-12 ring-2 ring-primary/20 shadow-sm">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-base">{name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[19px] font-semibold leading-tight truncate">{name}</p>
              <p className="text-[13px] text-muted-foreground leading-tight truncate">{statusText}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/70 active:bg-muted touch-manipulation"
              aria-label="Close chat preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-[360px] max-h-[58dvh] overflow-y-auto overscroll-contain px-3 py-4 space-y-1 chat-wallpaper">
            {loading ? (
              <p className="text-center text-sm text-muted-foreground py-14">Loading chat…</p>
            ) : previewItems.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-14">No messages yet</p>
            ) : (
              previewItems.map((item) => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} className="flex justify-center py-2">
                      <span className="rounded-full bg-muted/90 px-3 py-1 text-[13px] font-semibold text-muted-foreground shadow-sm">
                        {format(new Date(item.date), 'MMM d')}
                      </span>
                    </div>
                  );
                }

                const message = item.message;
                const isOwn = message.sender_id === user?.id;
                const mediaIcon = getMediaIcon(message);
                const label = getMediaLabel(message);

                return (
                  <div key={item.key} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[78%] rounded-[18px] px-3.5 py-2 text-[15px] leading-snug shadow-sm',
                        isOwn
                          ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-black dark:text-white rounded-br-md'
                          : 'bg-white dark:bg-[#202c33] text-black dark:text-white border border-black/5 dark:border-white/5 rounded-bl-md'
                      )}
                    >
                      {message.media_url && message.media_type?.startsWith('image') && (
                        <img
                          src={message.media_url}
                          alt="Message attachment"
                          className="mb-1 max-h-40 w-full rounded-xl object-cover"
                          loading="lazy"
                        />
                      )}
                      {message.media_url && !message.media_type?.startsWith('image') && mediaIcon && (
                        <span className="mb-1 inline-flex items-center gap-1.5 text-[13px] font-medium opacity-80">
                          {mediaIcon}
                          {label}
                        </span>
                      )}
                      {label && !message.media_url && (
                        <span className="whitespace-pre-wrap break-words">{label}</span>
                      )}
                      {message.media_type?.startsWith('image') && message.content && (
                        <span className="whitespace-pre-wrap break-words">{message.content}</span>
                      )}
                      <span className="ml-2 inline-flex align-baseline text-[11px] opacity-70">
                        {format(new Date(message.created_at), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden divide-y divide-border/40">
          {onMarkUnread && (
            <Row
              icon={<CheckCheck className="h-6 w-6" />}
              label={unreadCount > 0 ? 'Mark as read' : 'Mark as unread'}
              onClick={() => {
                onMarkUnread();
                onClose();
              }}
            />
          )}
          <Row
            icon={isPinned ? <PinOff className="h-6 w-6" /> : <Pin className="h-6 w-6" />}
            label={isPinned ? 'Unpin' : 'Pin'}
            onClick={() => {
              togglePin();
              onClose();
            }}
          />
          <Row
            icon={isMuted ? <Bell className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
            label={isMuted ? 'Unmute' : 'Mute'}
            onClick={() => {
              toggleMute();
              onClose();
            }}
          />
          {onDelete && (
            <Row
              icon={<Trash2 className="h-6 w-6" />}
              label="Delete"
              danger
              onClick={() => {
                onDelete();
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};