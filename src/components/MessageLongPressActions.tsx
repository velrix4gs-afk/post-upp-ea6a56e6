import { useState, useRef, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Trash2, AlertCircle, Copy, VolumeX } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MessageLongPressActionsProps {
  messageId: string;
  messageContent: string;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (id: string) => Promise<void>;
  onMute?: (id: string) => void;
  onReport?: (id: string) => void;
}

export const MessageLongPressActions = ({
  messageId,
  messageContent,
  isOpen,
  onClose,
  onDelete,
  onMute,
  onReport,
}: MessageLongPressActionsProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(messageContent);
    toast({ title: 'Message copied to clipboard' });
    onClose();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(messageId);
      toast({ title: 'Message deleted' });
      onClose();
    } catch (error) {
      toast({ title: 'Failed to delete message', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMute = () => {
    if (onMute) {
      onMute(messageId);
      toast({ title: 'Chat muted' });
    }
    onClose();
  };

  const handleReport = () => {
    if (onReport) {
      onReport(messageId);
      toast({ title: 'Message reported' });
    }
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Message Actions</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 py-4">
          <Button
            variant="ghost"
            className="justify-start"
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          
          {onMute && (
            <Button
              variant="ghost"
              className="justify-start"
              onClick={handleMute}
            >
              <VolumeX className="h-4 w-4 mr-2" />
              Mute Chat
            </Button>
          )}
          
          {onReport && (
            <Button
              variant="ghost"
              className="justify-start text-amber-600"
              onClick={handleReport}
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Report Message
            </Button>
          )}
          
          {onDelete && (
            <Button
              variant="ghost"
              className="justify-start text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete Message'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Hook for long-press detection
export const useLongPress = (
  callback: () => void,
  ms: number = 500
) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  
  const start = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    timerRef.current = setTimeout(() => {
      callback();
    }, ms);
  };
  
  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };
  
  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
};
