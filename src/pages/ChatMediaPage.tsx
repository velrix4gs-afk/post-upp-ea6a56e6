import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BackNavigation } from '@/components/BackNavigation';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Image, Video, File, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import GradualBlur from '@/components/flair/GradualBlur';

interface MediaItem {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  sender_name: string;
}

const ChatMediaPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get('chat');
  const [images, setImages] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [files, setFiles] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (chatId) {
      fetchMedia();
    }
  }, [chatId]);

  const fetchMedia = async () => {
    if (!chatId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          media_url,
          media_type,
          created_at,
          sender_id
        `)
        .eq('chat_id', chatId)
        .not('media_url', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender names
      const enrichedData = await Promise.all(
        (data || []).map(async (item) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', item.sender_id)
            .single();

          return {
            ...item,
            sender_name: profile?.display_name || 'User'
          };
        })
      );

      // Categorize media
      setImages(enrichedData.filter(item => item.media_type?.startsWith('image')));
      setVideos(enrichedData.filter(item => item.media_type?.startsWith('video')));
      setFiles(enrichedData.filter(item => 
        !item.media_type?.startsWith('image') && 
        !item.media_type?.startsWith('video') &&
        !item.media_type?.startsWith('audio')
      ));
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BackNavigation title="Chat Media" />
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <Tabs defaultValue="images" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="images">
              <Image className="h-4 w-4 mr-2" />
              Images ({images.length})
            </TabsTrigger>
            <TabsTrigger value="videos">
              <Video className="h-4 w-4 mr-2" />
              Videos ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="files">
              <File className="h-4 w-4 mr-2" />
              Files ({files.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="relative">
            <ScrollArea className="h-[calc(100vh-250px)]">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Skeleton key={i} className="aspect-square rounded-lg" />
                  ))}
                </div>
              ) : images.length === 0 ? (
                <Card className="p-12 text-center">
                  <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No images in this chat</p>
                </Card>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                  {images.map((item) => (
                    <div key={item.id} className="group relative">
                      <img
                        src={item.media_url}
                        alt="Chat media"
                        className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                        onClick={() => window.open(item.media_url, '_blank')}
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <button
                          onClick={() => handleDownload(item.media_url, `image-${item.id}.jpg`)}
                          className="p-2 bg-white/20 rounded-full hover:bg-white/30"
                        >
                          <Download className="h-5 w-5 text-white" />
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.sender_name} • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            {!loading && images.length > 0 && (
              <GradualBlur
                position="bottom"
                height="3.5rem"
                target="parent"
                strength={1.4}
                layers={6}
                tint="hsl(var(--background))"
                zIndex={20}
                className="rounded-b-lg"
              />
            )}
          </TabsContent>

          <TabsContent value="videos">
            <ScrollArea className="h-[calc(100vh-250px)]">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="aspect-video rounded-lg" />
                  ))}
                </div>
              ) : videos.length === 0 ? (
                <Card className="p-12 text-center">
                  <Video className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No videos in this chat</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                  {videos.map((item) => (
                    <div key={item.id}>
                      <video
                        src={item.media_url}
                        controls
                        preload="metadata"
                        className="w-full aspect-video rounded-lg"
                      />
                      <div className="mt-2 text-sm text-muted-foreground">
                        {item.sender_name} • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="files">
            <ScrollArea className="h-[calc(100vh-250px)]">
              {loading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : files.length === 0 ? (
                <Card className="p-12 text-center">
                  <File className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No files in this chat</p>
                </Card>
              ) : (
                <div className="space-y-2 p-4">
                  {files.map((item) => (
                    <Card key={item.id} className="p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-muted rounded-lg">
                          <File className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">File attachment</p>
                          <p className="text-sm text-muted-foreground">
                            {item.sender_name} • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownload(item.media_url, `file-${item.id}`)}
                          className="p-2 hover:bg-muted rounded-lg transition"
                        >
                          <Download className="h-5 w-5" />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ChatMediaPage;
