import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, ImagePlus, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { reportSilently } from '@/lib/errorSuppression';

interface GalleryPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen media as a File, ready for upload. */
  onSelect: (file: File) => void;
}

const isVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

/**
 * Stylized gallery picker: shows the user's recent media in a grid and
 * falls back to the device picker, instead of jumping straight to the
 * raw system file browser.
 */
export const GalleryPickerSheet = ({ open, onOpenChange, onSelect }: GalleryPickerSheetProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('media_url, media_urls, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(40);
        if (error) throw error;
        const urls: string[] = [];
        (data || []).forEach((row: any) => {
          if (Array.isArray(row.media_urls)) urls.push(...row.media_urls.filter(Boolean));
          else if (row.media_url) urls.push(row.media_url);
        });
        if (!cancelled) setItems(Array.from(new Set(urls)).slice(0, 30));
      } catch (err) {
        // Silent: the device picker below still works.
        reportSilently('GALLERY_001', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, user?.id]);

  const pickExisting = useCallback(
    async (url: string) => {
      setBusyUrl(url);
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const name = url.split('/').pop()?.split('?')[0] || 'media';
        onSelect(new File([blob], name, { type: blob.type || 'image/jpeg' }));
        onOpenChange(false);
      } catch (err) {
        reportSilently('GALLERY_002', err);
      } finally {
        setBusyUrl(null);
      }
    },
    [onSelect, onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[75vh] rounded-t-3xl p-0 flex flex-col"
      >
        <div className="px-4 pt-3 pb-2">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/30 mb-3" />
          <h2 className="text-base font-semibold">Choose media</h2>
          <p className="text-xs text-muted-foreground">Your recent uploads, or pick from your device.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10">
              <ImagePlus className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No recent media yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((url) => (
                <button
                  key={url}
                  onClick={() => pickExisting(url)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-muted touch-manipulation active:scale-[0.97] transition-transform"
                >
                  {isVideo(url) ? (
                    <video src={url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  {busyUrl === url && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className="border-t p-3"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              onSelect(f);
              onOpenChange(false);
            }}
          />
          <Button className="w-full rounded-xl h-11" onClick={() => inputRef.current?.click()}>
            <Check className="h-4 w-4 mr-2" />
            Browse device
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};