import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Video, FileText, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type ChatMediaMessage = Pick<
  Database['public']['Tables']['messages']['Row'],
  'id' | 'content' | 'media_url' | 'media_type' | 'created_at'
>;
type ChatLink = ChatMediaMessage & { link: string };

interface ChatMediaTabProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChatMediaTab = ({ chatId, open, onOpenChange }: ChatMediaTabProps) => {
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<{
    images: ChatMediaMessage[];
    videos: ChatMediaMessage[];
    files: ChatMediaMessage[];
    links: ChatLink[];
  }>({
    images: [],
    videos: [],
    files: [],
    links: [],
  });
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchChatMedia = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const { data: messages, error } = await supabase
          .from('messages')
          .select('id, content, media_url, media_type, created_at')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) throw error;
        if (cancelled) return;

        const images: ChatMediaMessage[] = [];
        const videos: ChatMediaMessage[] = [];
        const files: ChatMediaMessage[] = [];
        const links: ChatLink[] = [];

        messages?.forEach((msg) => {
          if (msg.media_url) {
          if (msg.media_type === 'image') {
            images.push(msg);
          } else if (msg.media_type === 'video') {
            videos.push(msg);
          } else if (msg.media_type && msg.media_type !== 'audio') {
            files.push(msg);
          }
          }

          const foundLinks = msg.content?.match(/https?:\/\/[^\s]+/g);
          foundLinks?.forEach((link) => links.push({ ...msg, link }));
        });

        setMedia({ images, videos, files, links });
      } catch (error) {
        console.error('Error fetching chat media:', error);
        if (!cancelled) {
          setLoadError(true);
          toast({ title: 'Could not load shared media', variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchChatMedia();
    return () => { cancelled = true; };
  }, [chatId, open, retryCount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shared media</DialogTitle>
          <DialogDescription>Photos, videos, files, and links shared in this chat.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="images" className="flex min-h-0 w-full flex-1 flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="images">
            <Image className="h-4 w-4 mr-2" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="videos">
            <Video className="h-4 w-4 mr-2" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="files">
            <FileText className="h-4 w-4 mr-2" />
            Files
          </TabsTrigger>
          <TabsTrigger value="links">
            <LinkIcon className="h-4 w-4 mr-2" />
            Links
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading shared media…
          </div>
        ) : loadError ? (
          <div role="alert" className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-destructive">
            <p>Shared media could not be loaded. Check your connection and try again.</p>
            <Button variant="outline" onClick={() => setRetryCount((count) => count + 1)}>Retry</Button>
          </div>
        ) : (
          <>
        <TabsContent value="images">
          <ScrollArea className="h-[min(400px,55dvh)]">
            <div className="grid grid-cols-3 gap-2">
              {media.images.map((item) => (
                <a
                  key={item.id}
                  href={item.media_url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-lg"
                  aria-label="Open shared photo"
                >
                  <img
                    src={item.media_url || undefined}
                    alt="Chat media"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  />
                </a>
              ))}
            </div>
            {media.images.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No photos shared yet.</p>}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="videos">
          <ScrollArea className="h-[min(400px,55dvh)]">
            <div className="grid grid-cols-2 gap-2">
              {media.videos.map((item) => (
                <div key={item.id} className="aspect-video rounded-lg overflow-hidden">
                  <video
                    src={item.media_url || undefined}
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            {media.videos.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No videos shared yet.</p>}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="files">
          <ScrollArea className="h-[min(400px,55dvh)]">
            <div className="space-y-2">
              {media.files.map((item) => (
                <a
                  key={item.id}
                  href={item.media_url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.media_url?.split('/').pop() || 'Shared file'}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </a>
              ))}
            </div>
            {media.files.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No files shared yet.</p>}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="links">
          <ScrollArea className="h-[min(400px,55dvh)]">
            <div className="space-y-2">
              {media.links.map((item, idx) => (
                <a
                  key={`${item.id}-${idx}`}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <LinkIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-primary">{item.link}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </a>
              ))}
            </div>
            {media.links.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No links shared yet.</p>}
          </ScrollArea>
        </TabsContent>
          </>
        )}
      </Tabs>
      </DialogContent>
    </Dialog>
  );
};
