import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

interface FeedCreateMenuProps {
  trigger: ReactNode;
}

export const FeedCreateMenu = ({ trigger }: FeedCreateMenuProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  const openShowcaseCreator = () => {
    setOpen(false);
    navigate('/create/showcase');
  };

  const openPostCreator = () => {
    setOpen(false);
    navigate('/create/post');
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="z-[70] max-h-[88dvh] overflow-hidden rounded-t-[24px] border-border/50 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_48px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <DrawerHeader className="relative border-b border-border/40 px-5 pb-4 pt-5 text-center">
          <DrawerTitle>Create</DrawerTitle>
          <DrawerDescription>Choose what you would like to share.</DrawerDescription>
          <DrawerClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 h-9 w-9 rounded-full"
              aria-label="Close create menu"
            >
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <div className="mx-auto grid w-full max-w-xl gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={openPostCreator}
              className="group flex min-h-28 items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-[transform,background-color,border-color,box-shadow] duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md active:scale-[0.98]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                <FileText className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">Post</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Share with your feed
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={openShowcaseCreator}
              className="group flex min-h-28 items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 text-left shadow-sm transition-[transform,background-color,border-color,box-shadow] duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md active:scale-[0.98]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
                <Clapperboard className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">Showcase</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Share a moment for 24 hours
                </span>
              </span>
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
