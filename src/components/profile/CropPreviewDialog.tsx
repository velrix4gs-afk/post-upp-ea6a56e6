import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CropPreviewDialogProps {
  file: File | null;
  /** circle = avatar (1:1), rect = banner (16:9) */
  shape: 'circle' | 'rect';
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

const OUTPUT_SIZE = { circle: { w: 720, h: 720 }, rect: { w: 1600, h: 900 } };

/**
 * Live crop preview with a ring overlay. The user pans and zooms while
 * the framed area is shown exactly as it will appear once saved.
 */
export const CropPreviewDialog = ({ file, shape, onCancel, onConfirm }: CropPreviewDialogProps) => {
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleConfirm = useCallback(async () => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !file) return;
    setWorking(true);
    try {
      const frameRect = frame.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      const out = OUTPUT_SIZE[shape];
      const canvas = document.createElement('canvas');
      canvas.width = out.w;
      canvas.height = out.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas context');

      // Map the visible frame back onto the natural image pixels.
      const scale = img.naturalWidth / imgRect.width;
      const sx = (frameRect.left - imgRect.left) * scale;
      const sy = (frameRect.top - imgRect.top) * scale;
      const sw = frameRect.width * scale;
      const sh = frameRect.height * scale;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.w, out.h);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('crop failed');
      const name = file.name.replace(/\.[^.]+$/, '') + '-cropped.jpg';
      onConfirm(new File([blob], name, { type: 'image/jpeg' }));
    } catch {
      // Fall back to the original file so the user is never blocked.
      onConfirm(file);
    } finally {
      setWorking(false);
    }
  }, [file, shape, onConfirm]);

  if (!file) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <p className="text-sm font-semibold">
            {shape === 'circle' ? 'Position your photo' : 'Position your banner'}
          </p>
          <button
            onClick={onCancel}
            aria-label="Cancel crop"
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted touch-manipulation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="relative w-full bg-background overflow-hidden select-none touch-none"
          style={{ height: 320 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt="Crop preview"
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
              style={{
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                height: shape === 'circle' ? 300 : 240,
              }}
            />
          )}

          {/* Live crop ring */}
          <div
            ref={frameRef}
            className={cn(
              'absolute pointer-events-none border-2 border-primary/90',
              shape === 'circle' ? 'crop-ring-circle' : 'crop-ring-rect',
            )}
            style={
              shape === 'circle'
                ? { width: 200, height: 200, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
                : { width: 288, height: 162, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
            }
          />
        </div>

        <div className="px-5 py-4 space-y-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="flex-1 rounded-xl" onClick={handleConfirm} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Use photo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
