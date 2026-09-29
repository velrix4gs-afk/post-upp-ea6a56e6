import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from '@/components/MessageBubble';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Message } from '@/hooks/useMessages';
import { Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface StarredMessagesDialogProps {
  open: boolean;
  onClose: () => void;
  chatId?: string;
}

export const StarredMessagesDialog = ({ open, onClose, chatId }: StarredMessagesDialogProps) => {
  const { user } = useAuth();
  const [starredMessages, setStarredMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) {
      setStarredMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchStarredMessages = async () => {
      setLoading(true);
      try {
        const { data: starredRows, error: starredError } = await supabase
          .from('starred_messages')
          .select('message_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (starredError) throw starredError;

        const messageIds = (starredRows || []).map((row) => row.message_id);
        if (messageIds.length === 0) {
          if (!cancelled) setStarredMessages([]);
          return;
        }

        let messageQuery = supabase
          .from('messages')
          .select('id, chat_id, sender_id, content, media_url, media_type, created_at, is_edited')
          .in('id', messageIds);
        if (chatId) messageQuery = messageQuery.eq('chat_id', chatId);
        const { data: rows, error: messagesError } = await messageQuery;
        if (messagesError) throw messagesError;

        const messages = rows || [];
        const senderIds = [...new Set(messages.map((message) => message.sender_id))];
        const { data: profiles, error: profilesError } = senderIds.length
          ? await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', senderIds)
          : { data: [], error: null };
        if (profilesError) throw profilesError;
        if (cancelled) return;

        const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
        const messagesById = new Map(messages.map((message) => [message.id, message]));
        setStarredMessages(messageIds.flatMap((id) => {
          const message = messagesById.get(id);
          if (!message) return [];
          const sender = profilesById.get(message.sender_id);
          return [{
            ...message,
            content: message.content || undefined,
            media_url: message.media_url || undefined,
            media_type: message.media_type || undefined,
            is_edited: Boolean(message.is_edited),
            updated_at: message.created_at,
            status: 'sent' as const,
            sender: {
              username: sender?.username || 'user',
              display_name: sender?.display_name || 'User',
              avatar_url: sender?.avatar_url || undefined,
            },
          }];
        }));
      } catch (error) {
        console.error('Error fetching starred messages:', error);
        if (!cancelled) {
          toast({ title: 'Failed to load starred messages', variant: 'destructive' });
          setStarredMessages([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchStarredMessages();
    return () => {
      cancelled = true;
    };
  }, [open, user, chatId]);

  const handleUnstar = async (messageId: string) => {
    if (!user) return;
    const previousMessages = starredMessages;
    setStarredMessages((previous) => previous.filter((message) => message.id !== messageId));
    const { error } = await supabase
      .from('starred_messages')
      .delete()
      .eq('user_id', user.id)
      .eq('message_id', messageId);

    if (error) {
      console.error('Error unstarring message:', error);
      setStarredMessages(previousMessages);
      toast({ title: 'Failed to unstar message', variant: 'destructive' });
      return;
    }
    toast({ title: 'Message unstarred' });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
            Starred Messages
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="space-y-4 p-4">
              {[1, 2, 3].map((index) => (
                <div key={index} className="animate-pulse">
                  <div className="h-20 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : starredMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="font-medium mb-2">No starred messages</p>
              <p className="text-sm">Star important messages to find them easily later</p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {starredMessages.map((message) => (
                <div key={message.id} className="border-b pb-4 last:border-0">
                  <MessageBubble
                    id={message.id}
                    content={message.content || ''}
                    sender={message.sender}
                    timestamp={message.created_at}
                    isOwn={message.sender_id === user?.id}
                    mediaUrl={message.media_url}
                    mediaType={message.media_type}
                    isEdited={message.is_edited}
                    isStarred
                    onUnstar={handleUnstar}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
