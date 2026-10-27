import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

interface MediaGalleryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaUrls: string[];
  initialIndex?: number;
  onSelect: (url: string) => void;
}

export const MediaGalleryModal = ({
  open,
  onOpenChange,
  mediaUrls,
  initialIndex = 0,
  onSelect,
}: MediaGalleryModalProps) => {
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;
    // If user swipes down by more than 100px, close it
    if (deltaY > 100) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl p-2 bg-black border-none sm:rounded-2xl [&>button]:hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Floating Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 left-4 z-50 p-2 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2 mt-10 max-h-[75vh] overflow-y-auto pb-6">
          {mediaUrls.map((url, i) => (
            <div
              key={url}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl cursor-pointer",
                i === initialIndex && "ring-2 ring-white/50"
              )}
              onClick={() => {
                onSelect(url);
                onOpenChange(false);
              }}
            >
              <img
                src={url}
                alt={`Media ${i + 1}`}
                className="object-cover w-full h-full transition-transform hover:scale-105"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};