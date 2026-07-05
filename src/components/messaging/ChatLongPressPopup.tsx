import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCheck, Pin, PinOff, Bell, BellOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { useChatSettings } from '@/hooks/useChatSettings';

interface ChatLongPressPopupProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
  name: string;
  avatarUrl?: string;
  lastMessage?: string;
  unreadCount?: number;
  onMarkUnread?: () => void;
  onDelete?: () => void;
}

type RowProps = {
  icon: React.ReactNode;
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
      'w-full h-12 px-4 flex items-center gap-3 text-left text-[15px] rounded-xl',
      'hover:bg-muted/60 active:bg-muted transition-colors',
      danger && 'text-destructive'
    )}
  >
    <span className="h-5 w-5 flex items-center justify-center flex-shrink-0">{icon}</span>
    <span className="font-medium">{label}</span>
  </button>
);

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
  lastMessage,
  unreadCount = 0,
  onMarkUnread,
  onDelete,
}: ChatLongPressPopupProps) => {
  const { settings, togglePin, toggleMute } = useChatSettings(chatId);
  const isPinned = !!settings?.is_pinned;
  const isMuted = !!settings?.is_muted;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={cn(
          'p-0 gap-0 border-0 bg-transparent shadow-none max-w-sm',
          'sm:max-w-sm'
        )}
      >
        <div className="rounded-2xl bg-card/95 backdrop-blur-xl border border-border/40 shadow-2xl overflow-hidden">
          {/* Chat header preview */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
            <Avatar className="h-11 w-11">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] truncate">{name}</p>
              {lastMessage && (
                <p className="text-[13px] text-muted-foreground truncate">{lastMessage}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="p-2 flex flex-col">
            {onMarkUnread && (
              <Row
                icon={<CheckCheck className="h-5 w-5" />}
                label={unreadCount > 0 ? 'Mark as read' : 'Mark as unread'}
                onClick={() => {
                  onMarkUnread();
                  onClose();
                }}
              />
            )}
            <Row
              icon={isPinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
              label={isPinned ? 'Unpin' : 'Pin'}
              onClick={() => {
                togglePin();
                onClose();
              }}
            />
            <Row
              icon={isMuted ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              label={isMuted ? 'Unmute' : 'Mute'}
              onClick={() => {
                toggleMute();
                onClose();
              }}
            />
            {onDelete && (
              <Row
                icon={<Trash2 className="h-5 w-5" />}
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
      </DialogContent>
    </Dialog>
  );
};