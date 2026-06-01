import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  MoreVertical,
  Download,
  Share2,
  ExternalLink,
  Flag,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

interface ImageGalleryViewerProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorHandle?: string;
  caption?: string;
  postId?: string;
  onViewOriginal?: () => void;
  onReport?: () => void;
}

export const ImageGalleryViewer = ({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
  authorHandle,
  caption,
  postId,
  onViewOriginal,
  onReport,
}: ImageGalleryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const lastTapRef = useRef<number>(0);
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const swipeStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [open, initialIndex]);

  const handlePrevious = () => {
    haptic('light');
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    setZoom(1);
    setTranslate({ x: 0, y: 0 });
  };

  const handleNext = () => {
    haptic('light');
    setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    setZoom(1);
    setTranslate({ x: 0, y: 0 });
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(images[currentIndex]);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${currentIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      haptic('success');
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Share Image',
          url: images[currentIndex],
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(images[currentIndex]);
      } catch {}
    }
  };

  const handleDoubleTap = () => {
    haptic('medium');
    setZoom(z => (z > 1 ? 1 : 2));
    setTranslate({ x: 0, y: 0 });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartRef.current = { dist: Math.hypot(dx, dy), zoom };
    } else if (e.touches.length === 1) {
      swipeStartRef.current = e.touches[0].clientX;
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        handleDoubleTap();
      }
      lastTapRef.current = now;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const next = Math.min(4, Math.max(1, pinchStartRef.current.zoom * (dist / pinchStartRef.current.dist)));
      setZoom(next);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    pinchStartRef.current = null;
    if (swipeStartRef.current !== null && zoom === 1 && images.length > 1) {
      const dx = (e.changedTouches[0]?.clientX ?? swipeStartRef.current) - swipeStartRef.current;
      if (Math.abs(dx) > 60) {
        dx > 0 ? handlePrevious() : handleNext();
      }
    }
    swipeStartRef.current = null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-screen h-[100dvh] p-0 bg-black/85 backdrop-blur-lg border-0 rounded-none gap-0 sm:rounded-none"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="relative w-full h-full overflow-hidden">
          {/* Floating top controls */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 pt-[max(env(safe-area-inset-top,0px),12px)]">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-white bg-black/30 backdrop-blur-md hover:bg-black/50 rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            {images.length > 1 && (
              <span className="text-white/90 text-xs font-medium px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md">
                {currentIndex + 1} / {images.length}
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-white bg-black/30 backdrop-blur-md hover:bg-black/50 rounded-full"
                  aria-label="More"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Save to Device
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Media
                </DropdownMenuItem>
                {(onViewOriginal || postId) && (
                  <DropdownMenuItem
                    onClick={() => {
                      onOpenChange(false);
                      onViewOriginal?.();
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Original Post
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    onOpenChange(false);
                    onReport?.();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Report Content
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Centered image canvas */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ touchAction: 'none' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onDoubleClick={handleDoubleTap}
          >
            <img
              src={images[currentIndex]}
              alt={`Image ${currentIndex + 1}`}
              draggable={false}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${zoom})`,
                transition: pinchStartRef.current ? 'none' : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: 'transform',
              }}
            />
          </div>

          {/* Contextual caption footer */}
          {(authorHandle || caption) && (
            <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pt-16 pb-[max(env(safe-area-inset-bottom,0px),20px)] bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none">
              {authorHandle && (
                <p className="text-white font-bold text-[15px] leading-tight">
                  @{authorHandle.replace(/^@/, '')}
                </p>
              )}
              {caption && (
                <p className="text-white/90 text-sm mt-1 line-clamp-3 leading-snug">
                  {caption}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
