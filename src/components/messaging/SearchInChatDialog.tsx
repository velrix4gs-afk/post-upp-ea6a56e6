import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SearchInChatDialogProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessageSelect: (messageId: string) => void;
}

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  sender: {
    display_name: string;
    avatar_url?: string;
  };
}

export const SearchInChatDialog = ({
  chatId,
  open,
  onOpenChange,
  onMessageSelect,
}: SearchInChatDialogProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const normalizedQuery = searchQuery.trim();

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (!open || normalizedQuery.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const searchMessages = async () => {
      setLoading(true);
      try {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('id, content, created_at, sender_id')
          .eq('chat_id', chatId)
          .ilike('content', `%${normalizedQuery}%`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        // Fetch sender profiles
        if (messages && messages.length > 0) {
          const senderIds = [...new Set(messages.map(m => m.sender_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', senderIds);

          if (cancelled || requestId !== requestIdRef.current) return;
          const messagesWithSender = messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            created_at: msg.created_at,
            sender: profiles?.find(p => p.id === msg.sender_id) || {
              display_name: 'Unknown',
              avatar_url: undefined,
            },
          }));

          setResults(messagesWithSender);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Error searching messages:', error);
        if (!cancelled && requestId === requestIdRef.current) setResults([]);
      } finally {
        if (!cancelled && requestId === requestIdRef.current) setLoading(false);
      }
    };

    void searchMessages();
    return () => {
      cancelled = true;
    };
  }, [chatId, normalizedQuery, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      requestIdRef.current += 1;
      setSearchQuery('');
      setResults([]);
      setLoading(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Search in Chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[400px]">
            {results.length === 0 && normalizedQuery.length >= 3 && !loading && (
              <p className="text-center text-muted-foreground py-8">No messages found</p>
            )}
            
            {results.length === 0 && normalizedQuery.length < 3 && (
              <p className="text-center text-muted-foreground py-8">
                Type at least 3 characters to search
              </p>
            )}

            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.id}
                  onClick={() => {
                    onMessageSelect(result.id);
                    onOpenChange(false);
                  }}
                  className="p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={result.sender.avatar_url} />
                      <AvatarFallback>{result.sender.display_name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{result.sender.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{result.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
