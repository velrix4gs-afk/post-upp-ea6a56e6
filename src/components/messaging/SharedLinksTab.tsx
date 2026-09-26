import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface SharedLinksTabProps {
  chatId: string;
}

interface LinkData {
  id: string;
  url: string;
  created_at: string;
  sender_name: string;
}

export const SharedLinksTab = ({ chatId }: SharedLinksTabProps) => {
  const [links, setLinks] = useState<LinkData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = useCallback(async () => {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, content, created_at, sender:profiles!messages_sender_id_fkey(display_name)')
        .eq('chat_id', chatId)
        .not('content', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      if (messages) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const extractedLinks: LinkData[] = [];

        messages.forEach((msg) => {
          const urls = msg.content?.match(urlRegex);
          if (urls) {
            const sender = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender;
            urls.forEach((url) => {
              extractedLinks.push({
                id: msg.id,
                url,
                created_at: msg.created_at,
                sender_name: sender?.display_name || 'Unknown',
              });
            });
          }
        });

        setLinks(extractedLinks);
      }
    } catch (error) {
      console.error('Error fetching links:', error);
      toast({ title: 'Could not load shared links', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    void fetchLinks();
  }, [fetchLinks]);

  if (loading) {
    return <div className="p-4 text-center">Loading links...</div>;
  }

  if (links.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ExternalLink className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No links shared yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="p-4 space-y-3">
        {links.map((link, index) => (
          <a
            key={`${link.id}-${index}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-lg border hover:bg-accent transition-colors group"
          >
            <div className="flex items-start gap-3">
              <ExternalLink className="h-5 w-5 mt-0.5 text-primary group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {link.url}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{link.sender_name}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </ScrollArea>
  );
};