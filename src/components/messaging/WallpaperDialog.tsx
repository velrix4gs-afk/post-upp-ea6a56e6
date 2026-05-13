import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChatSettings } from '@/hooks/useChatSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface WallpaperDialogProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const presetWallpapers = [
  { id: 'default', url: '', name: 'Default', color: 'bg-background' },
  { id: 'blue', url: '', name: 'Ocean Blue', color: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-950 dark:to-blue-900' },
  { id: 'green', url: '', name: 'Forest Green', color: 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-950 dark:to-green-900' },
  { id: 'purple', url: '', name: 'Purple Haze', color: 'bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-950 dark:to-purple-900' },
  { id: 'pink', url: '', name: 'Rose Pink', color: 'bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-950 dark:to-pink-900' },
  { id: 'orange', url: '', name: 'Sunset Orange', color: 'bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-950 dark:to-orange-900' },
];

export const WallpaperDialog = ({ chatId, open, onOpenChange }: WallpaperDialogProps) => {
  const { user } = useAuth();
  const { settings, setWallpaper } = useChatSettings(chatId);
  const [uploading, setUploading] = useState(false);
  const [selectedWallpaper, setSelectedWallpaper] = useState('default');

  // Reflect the persisted wallpaper for this chat whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    const current = settings?.wallpaper_url;
    if (!current) {
      setSelectedWallpaper('default');
    } else if (presetWallpapers.some((w) => w.id === current)) {
      setSelectedWallpaper(current);
    } else {
      setSelectedWallpaper('custom');
    }
  }, [open, settings?.wallpaper_url]);

  const handlePresetSelect = async (wallpaper: typeof presetWallpapers[0]) => {
    setSelectedWallpaper(wallpaper.id);
    await setWallpaper(wallpaper.id);
    onOpenChange(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileName = `${user.id}/${chatId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('messages')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('messages')
        .getPublicUrl(fileName);

      await setWallpaper(publicUrl);
      onOpenChange(false);
      
      toast({
        title: 'Success',
        description: 'Wallpaper updated',
      });
    } catch (error) {
      console.error('Error uploading wallpaper:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload wallpaper',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Change Chat Wallpaper</DialogTitle>
          <DialogDescription>Customize your chat background</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="presets">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
          </TabsList>
          
          <TabsContent value="presets" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {presetWallpapers.map((wallpaper) => (
                <button
                  key={wallpaper.id}
                  onClick={() => handlePresetSelect(wallpaper)}
                  className={`h-32 rounded-lg border-2 transition ${
                    selectedWallpaper === wallpaper.id 
                      ? 'border-primary' 
                      : 'border-transparent hover:border-muted-foreground'
                  } ${wallpaper.color}`}
                >
                  <span className="sr-only">{wallpaper.name}</span>
                </button>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="upload" className="space-y-4">
            <div>
              <Label htmlFor="wallpaper">Upload Image</Label>
              <Input
                id="wallpaper"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Choose an image from your device
              </p>
            </div>
            {uploading && (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
