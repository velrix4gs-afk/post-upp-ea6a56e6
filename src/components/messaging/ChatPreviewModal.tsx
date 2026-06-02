import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        'fixed inset-0 z-[90] flex items-center justify-center touch-manipulation',
        'backdrop-blur-md bg-black/30 transition-opacity duration-200',
        entered ? 'opacity-100' : 'opacity-0'
      )}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }}
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'mx-auto w-[340px] max-w-[90%] rounded-3xl shadow-2xl bg-card overflow-hidden',
          'transition-all duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]',
          entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
      >
        <div className="px-4 pt-4 pb-3 border-b border-border/40 flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate">{name}</p>
            <p className="text-[11px] text-muted-foreground">Preview · not marked as read</p>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto overscroll-contain px-3 py-3 space-y-1.5 bg-muted/20">
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
            className="w-full py-3 text-sm font-medium text-primary border-t border-border/40 hover:bg-muted/40 tap-scale touch-manipulation"
          >
            Open chat
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};