import { Image, Camera, Film, Smile, FileText, MapPin, User, CalendarClock, LucideIcon } from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

interface AttachmentOption {
  icon: LucideIcon;
  label: string;
  /** Icon colour — each action has its own, WhatsApp style. */
  color: string;
  onClick: () => void;
}

interface ChatAttachmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGalleryClick: () => void;
  onCameraClick: () => void;
  onGifsClick: () => void;
  onStickersClick: () => void;
  onFilesClick: () => void;
  onLocationClick: () => void;
  onContactsClick: () => void;
  onScheduleClick: () => void;
}

const AttachmentButton = ({ icon: Icon, label, color, onClick }: AttachmentOption) => (
  <button onClick={onClick} className="flex flex-col items-center gap-2 group">
    <div className="flex h-[52px] w-full max-w-[96px] items-center justify-center rounded-full border border-border bg-background group-active:scale-95 group-active:bg-muted transition-all duration-150">
      <Icon className="h-7 w-7" style={{ color }} strokeWidth={2.25} />
    </div>
    <span className="text-[13px] text-foreground/80">{label}</span>
  </button>
);

export const ChatAttachmentsSheet = ({
  open, onOpenChange, onGalleryClick, onCameraClick, onGifsClick, onStickersClick,
  onFilesClick, onLocationClick, onContactsClick, onScheduleClick,
}: ChatAttachmentsSheetProps) => {
  const run = (action: () => void) => () => { action(); onOpenChange(false); };

  const options: AttachmentOption[] = [
    { icon: Image, label: 'Gallery', color: '#1d8bf1', onClick: run(onGalleryClick) },
    { icon: Camera, label: 'Camera', color: '#ec407a', onClick: run(onCameraClick) },
    { icon: MapPin, label: 'Location', color: '#12b76a', onClick: run(onLocationClick) },
    { icon: User, label: 'Contact', color: '#0ea5e9', onClick: run(onContactsClick) },
    { icon: FileText, label: 'Document', color: '#7c4dff', onClick: run(onFilesClick) },
    { icon: Film, label: 'GIFs', color: '#f59e0b', onClick: run(onGifsClick) },
    { icon: Smile, label: 'Stickers', color: '#ff7043', onClick: run(onStickersClick) },
    { icon: CalendarClock, label: 'Schedule', color: '#f43f5e', onClick: run(onScheduleClick) },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-6">
        <div className="px-4 pb-2 pt-5">
          <div className="grid grid-cols-4 gap-x-3 gap-y-5">
            {options.map((o) => <AttachmentButton key={o.label} {...o} />)}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
