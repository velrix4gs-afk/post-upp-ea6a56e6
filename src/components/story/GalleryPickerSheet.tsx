import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Check, File as FileIcon, FolderOpen, ImagePlus, Images, Loader2, Play, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { toast } from '@/hooks/use-toast';
import { reportSilently } from '@/lib/errorSuppression';
import {
  canUseNativeGallery,
  checkDeviceGalleryAccess,
  deviceItemToFile,
  filesToGalleryItems,
  formatDuration,
  listNativeDeviceMedia,
  openDeviceGallerySettings,
  pickDeviceFolder,
  requestDeviceGalleryAccess,
  revokeGalleryThumbs,
  type DeviceGalleryItem,
  type GalleryFilter,
} from '@/lib/deviceGallery';

interface GalleryPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (file: File) => void;
  multiple?: boolean;
  onSelectMany?: (files: File[]) => void;
  title?: string;
}

type AccessState = 'checking' | 'ready' | 'denied' | 'web';

/**
 * In-app camera-roll picker. On Android it reads the device library;
 * on web it uses folder access or the system file picker, then shows
 * the same stylish grid.
 */
export const GalleryPickerSheet = ({
  open,
  onOpenChange,
  onSelect,
  multiple = false,
  onSelectMany,
  title = 'Gallery',
}: GalleryPickerSheetProps) => {
  const [items, setItems] = useState<DeviceGalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [access, setAccess] = useState<AccessState>('checking');
  const [quantity, setQuantity] = useState(120);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setFilter('all');
      setQuantity(120);
      setBusyId(null);
    }
  }, [open]);

  useEffect(() => {
    return () => revokeGalleryThumbs(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (onSelectMany) onSelectMany(files);
      else files.forEach((f) => onSelect(f));
    },
    [onSelect, onSelectMany],
  );

  const loadNative = useCallback(async (count: number, nextFilter: GalleryFilter) => {
    setLoading(true);
    let timeoutId: number | undefined;
    try {
      const next = await Promise.race([
        listNativeDeviceMedia(count, nextFilter),
        new Promise<DeviceGalleryItem[]>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('Gallery loading timed out')), 15000);
        }),
      ]);
      setItems((prev) => {
        revokeGalleryThumbs(prev);
        return next;
      });
      setAccess('ready');
    } catch (err) {
      reportSilently('GALLERY_001', err);
      setAccess('denied');
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const boot = async () => {
      if (!canUseNativeGallery()) {
        setAccess('web');
        return;
      }
      setAccess('checking');
      setLoading(true);
      const already = await checkDeviceGalleryAccess();
      const granted = already || (await requestDeviceGalleryAccess());
      if (cancelled) return;
      setAccess(granted ? 'ready' : 'denied');
      if (!granted) {
        setLoading(false);
        setItems([]);
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Fixes: tapping "Open settings", granting access there, then coming
  // back left the sheet stuck showing "Allow access" forever — nothing
  // was re-checking permission once the app regained focus. This
  // re-verifies whenever the app becomes visible again while the denied
  // screen is showing.
  useEffect(() => {
    if (!open || access !== 'denied' || !canUseNativeGallery()) return;

    const recheck = async () => {
      const granted = await checkDeviceGalleryAccess();
      if (granted) setAccess('ready');
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') recheck();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', recheck);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', recheck);
    };
  }, [open, access]);

  useEffect(() => {
    if (!open || access !== 'ready') return;
    loadNative(quantity, filter);
  }, [open, access, quantity, filter, loadNative]);

  const confirmIds = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      setConfirming(true);
      try {
        const chosen = ids
          .map((id) => items.find((item) => item.id === id))
          .filter((item): item is DeviceGalleryItem => Boolean(item));
        const files = await Promise.all(chosen.map((item) => deviceItemToFile(item)));
        emitFiles(files);
        onOpenChange(false);
      } catch (err) {
        reportSilently('GALLERY_003', err);
      } finally {
        setConfirming(false);
        setBusyId(null);
      }
    },
    [items, emitFiles, onOpenChange],
  );

  const pickExisting = useCallback(
    async (item: DeviceGalleryItem) => {
      haptic('light');
      if (multiple) {
        setSelected((prev) => {
          if (prev.includes(item.id)) return prev.filter((id) => id !== item.id);
          if (prev.length >= 10) {
            toast({
              title: 'Selection limit reached',
              description: 'Choose up to 10 items for one post.',
              variant: 'destructive',
            });
            return prev;
          }
          return [...prev, item.id];
        });
        return;
      }
      setBusyId(item.id);
      await confirmIds([item.id]);
    },
    [multiple, confirmIds],
  );

  const ingestFiles = useCallback(
    (fileList: File[]) => {
      const next = filesToGalleryItems(fileList);
      if (next.length === 0) return;
      if (multiple && next.length > 10) {
        toast({
          title: 'Selection limit reached',
          description: 'Choose up to 10 items for one post.',
          variant: 'destructive',
        });
      }
      setItems((prev) => {
        revokeGalleryThumbs(prev);
        return multiple ? next.slice(0, 10) : next;
      });
      setSelected(multiple ? next.slice(0, 10).map((item) => item.id) : []);
      setAccess('web');
    },
    [multiple],
  );

  const openFolder = useCallback(async () => {
    try {
      const next = await pickDeviceFolder();
      setItems((prev) => {
        revokeGalleryThumbs(prev);
        return next;
      });
      setAccess('web');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      folderInputRef.current?.click();
    }
  }, []);

  const visible = items.filter((item) => {
    if (filter === 'photos') return item.kind === 'image';
    if (filter === 'videos') return item.kind === 'video';
    return true;
  });

  const showGrant = access === 'denied' || (access === 'web' && items.length === 0 && !loading);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        overlayClassName="z-[110]"
        className="z-[111] h-[min(92dvh,900px)] rounded-t-[28px] p-0 flex flex-col bg-background border-t overflow-hidden"
      >
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/30 mb-3" />
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              <p className="text-xs text-muted-foreground">
                {canUseNativeGallery() ? 'Photos and videos on this device' : 'Photos and videos from this device'}
              </p>
            </div>
            <div className="flex rounded-full bg-muted p-0.5">
              {(['all', 'photos', 'videos'] as GalleryFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    'px-3 h-7 rounded-full text-[11px] font-medium capitalize transition-colors',
                    filter === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {(loading || access === 'checking') && items.length === 0 ? (
            <div className="relative">
              <div className="grid grid-cols-4 gap-0.5 px-0.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-muted animate-pulse" />
                ))}
              </div>
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
                <span className="rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow">
                  Loading your photos...
                </span>
              </div>
            </div>
          ) : showGrant ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-8 py-10">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Images className="h-8 w-8" />
              </div>
              <p className="text-base font-semibold mb-1">Show your camera roll</p>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                {canUseNativeGallery()
                  ? 'Allow photo and video access to pick from a stylish in-app gallery.'
                  : 'Browsers cannot open the full camera roll automatically. Choose your Pictures folder, or browse files.'}
              </p>
              {canUseNativeGallery() ? (
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <Button className="rounded-xl h-11" onClick={() => requestDeviceGalleryAccess().then((ok) => ok && setAccess('ready'))}>
                    <Shield className="h-4 w-4 mr-2" />
                    Allow access
                  </Button>
                  <Button variant="outline" className="rounded-xl h-11" onClick={() => openDeviceGallerySettings()}>
                    Open settings
                  </Button>
                  <Button
                    variant="ghost"
                    className="rounded-xl h-11"
                    onClick={() => {
                      setAccess('web');
                      inputRef.current?.click();
                    }}
                  >
                    Use system picker instead
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <Button className="rounded-xl h-11" onClick={openFolder}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Choose photos folder
                  </Button>
                  <Button variant="outline" className="rounded-xl h-11" onClick={() => inputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Browse files
                  </Button>
                </div>
              )}
            </div>
          ) : visible.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 px-6">
              <ImagePlus className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No {filter === 'all' ? 'media' : filter} found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-0.5 px-0.5">
                {visible.map((item) => {
                  const isSel = selected.includes(item.id);
                  const selIndex = selected.indexOf(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => pickExisting(item)}
                      className="relative aspect-square overflow-hidden bg-muted touch-manipulation active:scale-[0.98] transition-transform"
                    >
                      {item.kind === 'file' ? (
                        <div className="h-full w-full bg-muted flex flex-col items-center justify-center gap-1 px-2">
                          <FileIcon className="h-6 w-6 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{item.name}</span>
                        </div>
                      ) : item.kind === 'video' && item.thumbUrl && !item.thumbUrl.startsWith('data:') ? (
                        <video src={item.thumbUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                      ) : item.thumbUrl ? (
                        <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                      {item.kind === 'video' && (
                        <span className="absolute left-1 bottom-1 flex items-center gap-0.5 rounded-md bg-black/65 px-1 py-0.5 text-[10px] text-white">
                          <Play className="h-2.5 w-2.5 fill-white" />
                          {formatDuration(item.durationMs) || 'Video'}
                        </span>
                      )}
                      {multiple && (
                        <span
                          className={cn(
                            'absolute top-1 right-1 h-5 w-5 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold',
                            isSel
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-white/90 bg-black/25',
                          )}
                        >
                          {isSel ? selIndex + 1 : ''}
                        </span>
                      )}
                      {isSel && <span className="absolute inset-0 ring-2 ring-primary ring-inset bg-primary/10" />}
                      {busyId === item.id && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {access === 'ready' && items.length >= quantity && quantity < 400 && (
                <div className="p-3">
                  <Button
                    variant="ghost"
                    className="w-full rounded-xl"
                    disabled={loading}
                    onClick={() => setQuantity((q) => Math.min(q + 80, 400))}
                  >
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div
          className="border-t p-3 bg-background shrink-0"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple={multiple}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              if (files.length === 0) return;
              ingestFiles(files);
            }}
          />
          <input
            ref={folderInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              if (files.length === 0) return;
              ingestFiles(files);
            }}
          />
          <div className="flex gap-2">
            <Button
              variant={multiple && selected.length > 0 ? 'outline' : 'default'}
              className="flex-1 rounded-xl h-11"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4 mr-2" />
              {items.length > 0 ? 'Browse more' : 'Browse device'}
            </Button>
            {multiple && selected.length > 0 && (
              <Button className="flex-1 rounded-xl h-11" onClick={() => confirmIds(selected)} disabled={confirming}>
                {confirming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Add {selected.length}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};