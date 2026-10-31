import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef, useState } from 'react';

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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);

  if (!open) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaY = touchEndY - touchStartY.current;
    const deltaX = touchEndX - touchStartX.current;
    // If user swipes down by more than 100px, close the gallery
    if (deltaY > 100 && Math.abs(deltaY) > Math.abs(deltaX)) {
      onOpenChange(false);
      return;
    }
    // Swipe left/right to navigate between images in the viewer
    if (viewerIndex !== null) {
      if (deltaX > 50 && viewerIndex < mediaUrls.length - 1) {
        setViewerIndex(viewerIndex + 1);
      } else if (deltaX < -50 && viewerIndex > 0) {
        setViewerIndex(viewerIndex - 1);
      }
    }
  };

  const handleBackToGrid = () => {
    setViewerIndex(null);
  };

  const handleImageClick = (index: number) => {
    setViewerIndex(index);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      {/* Grid view */}
      {viewerIndex === null ? (
        <div className="flex flex-col h-full">
          {/* Header with X button */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center p-4 pt-[max(env(safe-area-inset-top),1rem)]">
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors"
              aria-label="Close gallery"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Scrollable 2-column grid */}
          <div
            className="flex-1 overflow-y-auto pt-[max(env(safe-area-inset-top),4rem)] pb-[max(env(safe-area-inset-bottom),1rem)]"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="grid grid-cols-2 gap-1 p-1">
              {mediaUrls.map((url, i) => (
                <div
                  key={url}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl cursor-pointer",
                    i === initialIndex && "ring-2 ring-white/50"
                  )}
                  onClick={() => handleImageClick(i)}
                >
                  <img
                    src={url}
                    alt={`Media ${i + 1}`}
                    className="object-cover w-full h-full transition-transform duration-200 hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Full-screen viewer - grid stays mounted behind it */
        <div className="flex flex-col h-full">
          {/* Viewer header with X button to return to grid */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center p-4 pt-[max(env(safe-area-inset-top),1rem)]">
            <button
              onClick={handleBackToGrid}
              className="p-2 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors"
              aria-label="Back to gallery"
            >
              <X className="h-6 w-6" />
            </button>
            <span className="ml-4 text-white text-sm font-medium">
              {viewerIndex + 1} / {mediaUrls.length}
            </span>
          </div>

          {/* Full-screen image */}
          <div
            className="flex-1 flex items-center justify-center overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={mediaUrls[viewerIndex]}
              alt={`Image ${viewerIndex + 1}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Navigation dots */}
          {mediaUrls.length > 1 && (
            <div className="absolute bottom-8 inset-x-0 flex justify-center gap-1.5 z-20">
              {mediaUrls.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === viewerIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};