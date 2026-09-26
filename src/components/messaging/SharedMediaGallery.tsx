import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChatMedia } from '@/hooks/useChatMedia';
import { Image, Video, Music, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SharedMediaGalleryProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SharedMediaGallery = ({ chatId, open, onOpenChange }: SharedMediaGalleryProps) => {
  const { media, getImageMedia, getVideoMedia, getAudioMedia, getDocumentMedia, loading, error, refetch } = useChatMedia(chatId);

  if (loading || error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Shared Media</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center gap-3 h-64" role={error ? 'alert' : undefined}>
            {error ? (
              <>
                <p className="text-destructive">Could not load shared media: {error}</p>
                <Button onClick={() => void refetch()}>Retry</Button>
              </>
            ) : <p className="text-muted-foreground">Loading...</p>}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Shared Media & Files</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="images" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="images" className="gap-2">
              <Image className="h-4 w-4" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-2">
              <Video className="h-4 w-4" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-2">
              <Music className="h-4 w-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-2">
              <File className="h-4 w-4" />
              Files
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-96 mt-4">
            <TabsContent value="images" className="mt-0">
              <div className="grid grid-cols-3 gap-2">
                {getImageMedia().map((item) => (
                  <a
                    key={item.id}
                    href={item.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="aspect-square overflow-hidden rounded-lg hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={item.media_url}
                      alt="Shared image"
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
              {getImageMedia().length === 0 && (
                <p className="text-center text-muted-foreground py-8">No images shared yet</p>
              )}
            </TabsContent>

            <TabsContent value="videos" className="mt-0">
              <div className="grid grid-cols-2 gap-4">
                {getVideoMedia().map((item) => (
                  <div key={item.id} className="aspect-video overflow-hidden rounded-lg">
                    <video
                      src={item.media_url}
                      controls
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              {getVideoMedia().length === 0 && (
                <p className="text-center text-muted-foreground py-8">No videos shared yet</p>
              )}
            </TabsContent>

            <TabsContent value="audio" className="mt-0">
              <div className="space-y-2">
                {getAudioMedia().map((item) => (
                  <div key={item.id} className="p-4 bg-muted rounded-lg">
                    <audio src={item.media_url} controls className="w-full" />
                  </div>
                ))}
              </div>
              {getAudioMedia().length === 0 && (
                <p className="text-center text-muted-foreground py-8">No audio files shared yet</p>
              )}
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <div className="space-y-2">
                {getDocumentMedia().map((item) => (
                  <a
                    key={item.id}
                    href={item.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <File className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Document</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
              {getDocumentMedia().length === 0 && (
                <p className="text-center text-muted-foreground py-8">No files shared yet</p>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
