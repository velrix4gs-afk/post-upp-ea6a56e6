import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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

  useEffect(() => {
    if (!open || !chatId) return;
    let cancelled = false;
    setLoading(true);
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
    };
  }, [open, chatId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden touch-manipulation">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border/40">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base truncate">{name}</DialogTitle>
              <p className="text-[11px] text-muted-foreground">Preview · not marked as read</p>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto px-3 py-3 space-y-1.5 bg-muted/20">
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
                <div
                  key={m.id}
                  className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
                >
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
            onClick={() => {
              onClose();
              onOpenFull();
            }}
            className="w-full py-3 text-sm font-medium text-primary border-t border-border/40 hover:bg-muted/40 tap-scale touch-manipulation"
          >
            Open chat
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
};