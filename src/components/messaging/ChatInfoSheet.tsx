import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User, Pencil, Image as ImageIcon, Link2, Ban, Flag, Search, Bell, BellOff, ChevronRight, Palette,
} from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChatInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  username?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  isMuted?: boolean;
  onViewProfile: () => void;
  onSearch: () => void;
  onToggleMute: () => void;
  onSetNickname: () => void;
  onWallpaper: () => void;
  onSharedMedia: () => void;
  onSharedLinks: () => void;
  onBlock: () => void;
  onReport: () => void;
}

/** Round icon button with a label underneath (Messenger / Instagram style). */
const QuickAction = ({
  icon, label, onClick,
}: { icon: ReactNode; label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 w-20 tap-scale">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">{icon}</span>
    <span className="text-xs font-medium">{label}</span>
  </button>
);

const Row = ({
  icon, label, onClick, destructive,
}: { icon: ReactNode; label: string; onClick: () => void; destructive?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors',
      destructive && 'text-destructive',
    )}
  >
    <span className="flex h-8 w-8 items-center justify-center">{icon}</span>
    <span className="flex-1 text-[15px]">{label}</span>
    {!destructive && <ChevronRight className="h-4 w-4 opacity-40" />}
  </button>
);

const Group = ({ title, children }: { title?: string; children: ReactNode }) => (
  <div className="mt-4">
    {title && <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>}
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/40">{children}</div>
  </div>
);

/** Opened by tapping the chat header's user bar. Messenger/Instagram-style chat info. */
export const ChatInfoSheet = ({
  open, onOpenChange, name, username, avatarUrl, isOnline, isMuted,
  onViewProfile, onSearch, onToggleMute, onSetNickname, onWallpaper,
  onSharedMedia, onSharedLinks, onBlock, onReport,
}: ChatInfoSheetProps) => {
  // Close first, then run, so the next dialog isn't fighting this sheet's focus trap.
  const run = (fn: () => void) => () => {
    onOpenChange(false);
    setTimeout(fn, 150);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl bg-background px-0 pb-8 overflow-y-auto">
        <SheetTitle className="sr-only">{name}</SheetTitle>
        <SheetDescription className="sr-only">Chat info and actions for {name}</SheetDescription>

        <div className="mx-auto mt-1 mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />

        <div className="flex flex-col items-center text-center px-4">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-3xl">{name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            {isOnline && (
              <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-purple-500 border-[3px] border-background" />
            )}
          </div>
          <h2 className="mt-3 text-xl font-bold">{name}</h2>
          {username && <p className="text-sm text-muted-foreground">@{username}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">{isOnline ? 'Active now' : ''}</p>
        </div>

        <div className="flex justify-center gap-2 mt-5 px-4">
          <QuickAction icon={<User className="h-5 w-5" />} label="Profile" onClick={run(onViewProfile)} />
          <QuickAction
            icon={isMuted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            label={isMuted ? 'Unmute' : 'Mute'}
            onClick={() => onToggleMute()}
          />
          <QuickAction icon={<Search className="h-5 w-5" />} label="Search" onClick={run(onSearch)} />
        </div>

        <div className="px-4">
          <Group title="Customize">
            <Row icon={<Pencil className="h-5 w-5" />} label="Nickname" onClick={run(onSetNickname)} />
            <Row icon={<Palette className="h-5 w-5" />} label="Chat theme & wallpaper" onClick={run(onWallpaper)} />
          </Group>
          <Group title="Media & links">
            <Row icon={<ImageIcon className="h-5 w-5" />} label="Shared media" onClick={run(onSharedMedia)} />
            <Row icon={<Link2 className="h-5 w-5" />} label="Shared links" onClick={run(onSharedLinks)} />
          </Group>
          <Group title="Privacy & support">
            <Row icon={<Ban className="h-5 w-5" />} label="Block" onClick={run(onBlock)} destructive />
            <Row icon={<Flag className="h-5 w-5" />} label="Report" onClick={run(onReport)} destructive />
          </Group>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatInfoSheet;
