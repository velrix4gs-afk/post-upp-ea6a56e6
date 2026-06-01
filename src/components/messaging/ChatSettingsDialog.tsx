import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useChatSettings } from '@/hooks/useChatSettings';
import { toast } from '@/hooks/use-toast';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  UserCircle,
  Pencil,
  Images,
  BellOff,
  Bell,
  Sparkles,
  Trash2,
  Ban,
} from 'lucide-react';

interface ChatSettingsDialogProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Other user id, for navigating to their profile. Optional for group chats. */
  otherUserId?: string;
  isGroup?: boolean;
  onDeleteChat?: () => void;
  onBlockUser?: () => void;
}

type RowProps = {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  premium?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
};

const Row = ({ icon, label, danger, premium, trailing, onClick }: RowProps) => (
  <button
    type="button"
    onClick={() => {
      haptic('light');
      onClick?.();
    }}
    className={cn(
      'w-full h-14 px-5 flex items-center gap-4 text-left text-[15px] transition-colors',
      'hover:bg-muted/60 active:bg-muted',
      danger && 'text-destructive',
      premium && 'relative'
    )}
  >
    <span
      className={cn(
        'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0',
        danger ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground/80',
        premium && 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-500 dark:text-purple-300'
      )}
    >
      {icon}
    </span>
    <span className="flex-1 font-medium">{label}</span>
    {trailing}
  </button>
);

/**
 * Bottom-sheet chat info panel.
 * Trimmed to the essential quick actions; deep settings live on dedicated pages.
 */
export const ChatSettingsDialog = ({
  chatId,
  open,
  onOpenChange,
  otherUserId,
  isGroup,
  onDeleteChat,
  onBlockUser,
}: ChatSettingsDialogProps) => {
  const { settings, toggleMute } = useChatSettings(chatId);
  const navigate = useNavigate();
  const isMuted = !!settings?.is_muted;

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-3xl border-0 bg-background/95 backdrop-blur-xl max-h-[85dvh]"
      >
        <div className="fb-sheet-in">
          {/* Grab handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="pb-[max(env(safe-area-inset-bottom,0px),16px)]">
            {!isGroup && otherUserId && (
              <Row
                icon={<UserCircle className="h-5 w-5" />}
                label="View Profile"
                onClick={() => {
                  close();
                  navigate(`/profile/${otherUserId}`);
                }}
              />
            )}

            <Row
              icon={<Pencil className="h-5 w-5" />}
              label="Add Nickname"
              onClick={() => {
                toast({ title: 'Nicknames', description: 'Coming soon' });
              }}
            />

            <Row
              icon={<Images className="h-5 w-5" />}
              label="View Shared Media"
              onClick={() => {
                close();
                navigate(`/chat-media?chat=${chatId}`);
              }}
            />

            <Row
              icon={isMuted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
              label={isMuted ? 'Unmute Chat' : 'Mute Chat'}
              onClick={() => toggleMute()}
            />

            <Row
              icon={<Sparkles className="h-5 w-5" />}
              label="AI Summary"
              premium
              trailing={
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                  Premium
                </span>
              }
              onClick={() => {
                toast({ title: 'AI Summary', description: 'Premium feature — coming soon' });
              }}
            />

            <div className="h-px bg-border/60 my-1 mx-5" />

            <Row
              icon={<Trash2 className="h-5 w-5" />}
              label="Delete Chat"
              danger
              onClick={() => {
                close();
                onDeleteChat?.();
              }}
            />

            {!isGroup && (
              <Row
                icon={<Ban className="h-5 w-5" />}
                label="Block User"
                danger
                onClick={() => {
                  close();
                  onBlockUser?.();
                }}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
