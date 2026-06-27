import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, Reply, Forward, Star, Share2, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onReply?: () => void;
  onForward?: () => void;
  onStar?: () => void;
  isStarred?: boolean;
}

export const ImageViewer = ({
  open,
  onOpenChange,
  imageUrl,
  onReply,
  onForward,
  onStar,
  isStarred = false,
}: ImageViewerProps) => {
  const [zoom, setZoom] = useState(1);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Shared Image',
          url: imageUrl,
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    }
  };

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 3));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.5));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
        {/* Header with actions */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              className="text-white hover:bg-white/20"
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              className="text-white hover:bg-white/20"
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <span className="text-white text-sm">{Math.round(zoom * 100)}%</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Image */}
        <div className="flex items-center justify-center w-full h-full overflow-auto p-4">
          <img
            src={imageUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          />
        </div>

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-2 p-4 bg-gradient-to-t from-black/80 to-transparent">
          {onReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onReply();
                onOpenChange(false);
              }}
              className="text-white hover:bg-white/20"
            >
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </Button>
          )}
          {onForward && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onForward();
                onOpenChange(false);
              }}
              className="text-white hover:bg-white/20"
            >
              <Forward className="h-4 w-4 mr-2" />
              Forward
            </Button>
          )}
          {onStar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onStar();
              }}
              className="text-white hover:bg-white/20"
            >
              <Star className={cn("h-4 w-4 mr-2", isStarred && "fill-yellow-400 text-yellow-400")} />
              {isStarred ? 'Unstar' : 'Star'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="text-white hover:bg-white/20"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          {navigator.share && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="text-white hover:bg-white/20"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
