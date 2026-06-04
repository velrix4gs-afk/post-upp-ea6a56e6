import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Loader2, ChevronLeft, Phone, Video, MoreVertical } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { haptic } from '@/lib/haptics';

interface ChatPreviewModalProps {
  open: boolean;
  onClose: () => void;
  chatId: string | null;
  name: string;
  avatarUrl?: string;
  onOpenFull?: () => void;
}

interface PreviewMsg {
  id: string;
  content: string | null;
  media_url: string | null;
  sender_id: string;
  created_at: string;
}

/**
 * Read-only chat preview triggered by long-press. Does NOT mark messages as
 * read or insert into message_reads.
 */
export const ChatPreviewModal = ({
  open,
  onClose,
  chatId,
  name,
  avatarUrl,
  onOpenFull,
}: ChatPreviewModalProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PreviewMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [entered, setEntered] = useState(false);
  const rafRef = useRef<number>();
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (!open || !chatId) return;
    let cancelled = false;
    setLoading(true);
    setEntered(false);
    haptic('medium');
    rafRef.current = requestAnimationFrame(() => setEntered(true));
    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, content, media_url, sender_id, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(15);
      if (cancelled) return;
      setMessages(((data as PreviewMsg[]) || []).reverse());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open, chatId]);

  if (!open || typeof document === 'undefined') return null;

  const handleClose = () => {
    setEntered(false);
    setTimeout(onClose, 180);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        'fixed inset-0 z-[90] flex items-end justify-center touch-manipulation',
        'bg-black/40 transition-opacity duration-200',
        entered ? 'opacity-100' : 'opacity-0'
      )}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        handleClose();
      }}
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-[640px] bg-background flex flex-col overflow-hidden',
          'rounded-t-[32px] shadow-2xl border-t border-border/40',
          'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          entered ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{
          height: '80dvh',
          transform: entered
            ? `translateY(${Math.max(0, dragOffset)}px)`
            : undefined,
        }}
      >
        {/* Grab handle */}
        <div
          className="pt-2 pb-1 flex justify-center cursor-grab touch-none"
          onPointerDown={(e) => {
            e.stopPropagation();
            dragStartY.current = e.clientY;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragStartY.current == null) return;
            const delta = e.clientY - dragStartY.current;
            setDragOffset(delta);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (dragOffset > 120) {
              handleClose();
            }
            setDragOffset(0);
            dragStartY.current = null;
          }}
        >
          <div className="h-1 w-9 rounded-full bg-muted-foreground/40" />
        </div>

        {/* iOS-style header */}
        <div className="h-14 px-3 flex items-center gap-2 border-b border-border/40 shrink-0">
          <button
            onClick={handleClose}
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 tap-scale touch-manipulation"
            aria-label="Close preview"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-semibold truncate leading-tight">{name}</p>
            <p className="text-[13px] text-muted-foreground leading-tight">Preview</p>
          </div>
          <button
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 text-primary"
            aria-label="Voice call"
            onClick={() => {
              onClose();
              onOpenFull?.();
            }}
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 text-primary"
            aria-label="Video call"
            onClick={() => {
              onClose();
              onOpenFull?.();
            }}
          >
            <Video className="h-5 w-5" />
          </button>
          <button
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60"
            aria-label="More"
            onClick={() => {
              onClose();
              onOpenFull?.();
            }}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-1.5 bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">No messages yet</p>
          ) : (
            messages.map((m) => {
              const isOwn = m.sender_id === user?.id;
              return (
                <div key={m.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-3 py-1.5 text-[13.5px] leading-snug',
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card border border-border/40 rounded-bl-md'
                    )}
                  >
                    {m.media_url && !m.content && <span>📎 Attachment</span>}
                    {m.content && <span className="whitespace-pre-wrap break-words">{m.content}</span>}
                    <span
                      className={cn(
                        'block text-[10px] mt-0.5 opacity-70',
                        isOwn ? 'text-primary-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {format(new Date(m.created_at), 'h:mm a')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {onOpenFull && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              onClose();
              onOpenFull();
            }}
            className="w-full py-3 text-sm font-medium text-primary border-t border-border/40 hover:bg-muted/40 tap-scale touch-manipulation shrink-0"
          >
            Open chat
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};