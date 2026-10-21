import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Pencil, Image as ImageIcon, Link2, Ban, Flag, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChatInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  avatarUrl?: string;
  onViewProfile: () => void;
  onSetNickname: () => void;
  onSharedMedia: () => void;
  onSharedLinks: () => void;
  onBlock: () => void;
  onReport: () => void;
}

const Row = ({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl hover:bg-muted/60 active:bg-muted transition-colors',
      destructive && 'text-destructive'
    )}
  >
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/70">{icon}</span>
    <span className="flex-1 text-[15px] font-medium">{label}</span>
    <ChevronRight className="h-4 w-4 opacity-40" />
  </button>
);

/** Bottom action sheet opened by tapping the chat header's user bar. */
export const ChatInfoSheet = ({
  open,
  onOpenChange,
  name,
  avatarUrl,
  onViewProfile,
  onSetNickname,
  onSharedMedia,
  onSharedLinks,
  onBlock,
  onReport,
}: ChatInfoSheetProps) => {
  // Close first, then run the action so the next dialog isn't fighting this sheet's focus trap.
  const run = (fn: () => void) => () => {
    onOpenChange(false);
    setTimeout(fn, 150);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="items-center text-center pt-2 pb-3">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="text-xl">{name?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <SheetTitle className="text-lg">{name}</SheetTitle>
          <SheetDescription className="sr-only">Chat actions for {name}</SheetDescription>
        </SheetHeader>
        <div className="space-y-1">
          <Row icon={<User className="h-4 w-4" />} label="View Profile" onClick={run(onViewProfile)} />
          <Row icon={<Pencil className="h-4 w-4" />} label="Set Nickname" onClick={run(onSetNickname)} />
          <Row icon={<ImageIcon className="h-4 w-4" />} label="Shared Media" onClick={run(onSharedMedia)} />
          <Row icon={<Link2 className="h-4 w-4" />} label="Shared Links" onClick={run(onSharedLinks)} />
          <Row icon={<Ban className="h-4 w-4" />} label="Block" onClick={run(onBlock)} destructive />
          <Row icon={<Flag className="h-4 w-4" />} label="Report" onClick={run(onReport)} destructive />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatInfoSheet;
