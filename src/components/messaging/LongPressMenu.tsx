import { useState, useRef, useEffect, ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Reply, Forward, Copy, Star, Edit, Trash2, Smile, Pin, Download, Info } from 'lucide-react';

interface LongPressMenuProps {
  children: ReactNode;
  isOwn: boolean;
  isStarred?: boolean;
  content: string;
  onReply: () => void;
  onForward: () => void;
  onCopy: () => void;
  onStar: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReact?: () => void;
  onPin?: () => void;
  onDownload?: () => void;
  onInfo?: () => void;
}

export const LongPressMenu = ({
  children,
  isOwn,
  isStarred,
  content,
  onReply,
  onForward,
  onCopy,
  onStar,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onDownload,
  onInfo,
}: LongPressMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pressPosition, setPressPosition] = useState({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setPressPosition({ x: touch.clientX, y: touch.clientY });
    
    longPressTimer.current = setTimeout(() => {
      setIsOpen(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const moveDistance = Math.sqrt(
      Math.pow(touch.clientX - pressPosition.x, 2) +
      Math.pow(touch.clientY - pressPosition.y, 2)
    );
    
    if (moveDistance > 10 && longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
        >
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {onReact && (
          <>
            <ContextMenuItem onClick={onReact}>
              <Smile className="mr-2 h-4 w-4" />
              React
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        
        <ContextMenuItem onClick={onReply}>
          <Reply className="mr-2 h-4 w-4" />
          Reply
        </ContextMenuItem>
        
        <ContextMenuItem onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Text
        </ContextMenuItem>
        
        <ContextMenuItem onClick={onForward}>
          <Forward className="mr-2 h-4 w-4" />
          Forward
        </ContextMenuItem>
        
        <ContextMenuItem onClick={onStar}>
          <Star className={`mr-2 h-4 w-4 ${isStarred ? 'fill-primary text-primary' : ''}`} />
          {isStarred ? 'Unstar' : 'Star'}
        </ContextMenuItem>

        {onPin && (
          <ContextMenuItem onClick={onPin}>
            <Pin className="mr-2 h-4 w-4" />
            Pin Message
          </ContextMenuItem>
        )}

        {onInfo && (
          <ContextMenuItem onClick={onInfo}>
            <Info className="mr-2 h-4 w-4" />
            Message Info
          </ContextMenuItem>
        )}

        {onDownload && (
          <ContextMenuItem onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </ContextMenuItem>
        )}
        
        {isOwn && onEdit && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Message
            </ContextMenuItem>
          </>
        )}
        
        {isOwn && onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Message
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
