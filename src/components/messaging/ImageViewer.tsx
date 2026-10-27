import { useState, useEffect, useRef } from 'react';
import { X, Download, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface ImageViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    imageUrls: string[];
    initialIndex?: number;
    sender: { display_name: string; avatar_url?: string };
    timestamp: string;
    onReply?: () => void;
}

export const ImageViewer = ({
    open,
    onOpenChange,
    imageUrls,
    initialIndex = 0,
    sender,
    timestamp,
    onReply,
}: ImageViewerProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [scale, setScale] = useState(1);
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    useEffect(() => {
        if (open) {
            setCurrentIndex(initialIndex);
            setScale(1);
        }
    }, [open, initialIndex]);

    if (!open || imageUrls.length === 0) return null;

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (scale > 1) return; // Don't swipe if zoomed in
        const delta = touchStartX.current - touchEndX.current;
        if (delta > 50 && currentIndex < imageUrls.length - 1) {
            setCurrentIndex((prev) => prev + 1);
        } else if (delta < -50 && currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = imageUrls[currentIndex];
        link.download = `image-${currentIndex}.jpg`;
        link.click();
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl">
            {/* Top Bar */}
            <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={() => onOpenChange(false)} className="p-2 text-white/80 hover:text-white">
                    <X className="h-6 w-6" />
                </button>

                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={sender.avatar_url} />
                        <AvatarFallback>{sender.display_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-white text-sm font-semibold">{sender.display_name || 'User'}</span>
                        <span className="text-white/60 text-xs">{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</span>
                    </div>
                </div>

                <button onClick={handleDownload} className="p-2 text-white/80 hover:text-white">
                    <Download className="h-5 w-5" />
                </button>
            </div>

            {/* Image Area */}
            <div
                className="flex-1 flex items-center justify-center overflow-hidden touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onDoubleClick={() => setScale(1)}
            >
                <img
                    src={imageUrls[currentIndex]}
                    alt={`Image ${currentIndex + 1}`}
                    className="max-h-full max-w-full object-contain transition-transform duration-200"
                    style={{ transform: `scale(${scale})` }}
                />
            </div>

            {/* Pagination Dots (Optional but nice) */}
            {imageUrls.length > 1 && (
                <div className="absolute bottom-24 inset-x-0 flex justify-center gap-1.5 z-50">
                    {imageUrls.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`} />
                    ))}
                </div>
            )}

            {/* Bottom Bar */}
            <div className="absolute bottom-0 inset-x-0 z-50 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <div
                    onClick={() => { onOpenChange(false); onReply?.(); }}
                    className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-3 cursor-text"
                >
                    <Camera className="h-5 w-5 text-white/60" />
                    <span className="text-white/60 text-sm flex-1">Reply...</span>
                </div>
            </div>
        </div>
    );
};