import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Check, RotateCw, FlipHorizontal, FlipVertical, Minus, Plus } from 'lucide-react';

interface StoryCropToolProps {
  imageUrl: string;
  onSave: (croppedUrl: string) => void | Promise<void>;
  onClose: () => void;
}

interface CropView {
  zoom: number;
  x: number;
  y: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

interface CropGesture {
  zoom: number;
  x: number;
  y: number;
  distance: number;
  center: PointerPosition;
}

const aspectRatios = [
  { id: 'free', label: 'Original', value: null },
  { id: '9:16', label: '9:16', value: 9 / 16 },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:5', label: '4:5', value: 4 / 5 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export const StoryCropTool = ({ imageUrl, onSave, onClose }: StoryCropToolProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const gestureRef = useRef<CropGesture | null>(null);
  const viewRef = useRef<CropView>({ zoom: MIN_ZOOM, x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<CropView>(viewRef.current);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState('free');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const ratio = aspectRatios.find((item) => item.id === selectedRatio)?.value;
  const stageRatio = ratio || (
    canvasRef.current?.height && canvasRef.current.width
      ? canvasRef.current.width / canvasRef.current.height
      : 1
  );

  const clampView = useCallback((next: CropView): CropView => {
    const canvas = canvasRef.current;
    const { width, height } = stageSize;
    if (!canvas || !width || !height) return next;

    const coverScale = Math.max(width / canvas.width, height / canvas.height);
    const maxX = Math.max(0, (canvas.width * coverScale * next.zoom - width) / 2);
    const maxY = Math.max(0, (canvas.height * coverScale * next.zoom - height) / 2);
    return {
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next.zoom)),
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }, [stageSize]);

  const commitView = useCallback((next: CropView) => {
    const clamped = clampView(next);
    viewRef.current = clamped;
    setView(clamped);
  }, [clampView]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setSaveError(null);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setLoaded(true);
    };
    img.onerror = () => {
      if (!cancelled) setSaveError('Could not load this image for cropping.');
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
      imgRef.current = null;
    };
  }, [imageUrl]);

  useEffect(() => {
    const image = imgRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !loaded) return;

    const rotated = rotation % 180 !== 0;
    const width = rotated ? image.naturalHeight : image.naturalWidth;
    const height = rotated ? image.naturalWidth : image.naturalHeight;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      setSaveError('Could not prepare this image for cropping.');
      return;
    }
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    context.restore();
    commitView({ ...viewRef.current, x: 0, y: 0 });
  }, [rotation, flipH, flipV, loaded, commitView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const resize = () => {
      const bounds = viewport.getBoundingClientRect();
      const targetRatio = ratio || stageRatio;
      const width = Math.max(0, Math.min(bounds.width, 520, bounds.height * targetRatio));
      const height = targetRatio > 0 ? width / targetRatio : 0;
      setStageSize({ width, height });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(viewport);
    resize();
    return () => observer.disconnect();
  }, [ratio, stageRatio]);

  useEffect(() => {
    commitView(viewRef.current);
  }, [stageSize, commitView]);

  useEffect(() => {
    if (!ratio) commitView({ ...viewRef.current, x: 0, y: 0 });
  }, [selectedRatio, ratio, commitView]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pointers = pointersRef.current;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const positions = [...pointers.values()];
    const center = positions.length > 1
      ? { x: (positions[0].x + positions[1].x) / 2, y: (positions[0].y + positions[1].y) / 2 }
      : positions[0];
    const distance = positions.length > 1
      ? Math.hypot(positions[0].x - positions[1].x, positions[0].y - positions[1].y)
      : 0;
    gestureRef.current = {
      ...viewRef.current,
      distance,
      center,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    if (!gesture) return;
    const positions = [...pointers.values()];

    if (positions.length > 1 && gesture.distance > 0) {
      const center = {
        x: (positions[0].x + positions[1].x) / 2,
        y: (positions[0].y + positions[1].y) / 2,
      };
      const distance = Math.hypot(positions[0].x - positions[1].x, positions[0].y - positions[1].y);
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, gesture.zoom * distance / gesture.distance));
      const stage = viewportRef.current?.getBoundingClientRect();
      const focalX = stage ? gesture.center.x - stage.left - stage.width / 2 : 0;
      const focalY = stage ? gesture.center.y - stage.top - stage.height / 2 : 0;
      const scale = zoom / gesture.zoom;
      commitView({
        zoom,
        x: gesture.x + focalX * (1 - scale) + center.x - gesture.center.x,
        y: gesture.y + focalY * (1 - scale) + center.y - gesture.center.y,
      });
      return;
    }

    const pointer = positions[0];
    commitView({
      ...viewRef.current,
      x: gesture.x + pointer.x - gesture.center.x,
      y: gesture.y + pointer.y - gesture.center.y,
    });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    const remaining = [...pointersRef.current.values()];
    const current = viewRef.current;
    if (remaining.length) {
      gestureRef.current = {
        ...current,
        distance: 0,
        center: remaining[0],
      };
    } else {
      gestureRef.current = null;
    }
  };

  const handleZoomChange = (zoom: number) => {
    commitView({ ...viewRef.current, zoom });
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    const { width: stageWidth, height: stageHeight } = stageSize;
    if (!canvas || !loaded || !stageWidth || !stageHeight || saving) return;
    setSaving(true);
    setSaveError(null);
    let outputUrl: string | null = null;
    try {
      const coverScale = Math.max(stageWidth / canvas.width, stageHeight / canvas.height);
      const sourceWidth = stageWidth / (coverScale * view.zoom);
      const sourceHeight = stageHeight / (coverScale * view.zoom);
      const sourceX = canvas.width / 2 - view.x / (coverScale * view.zoom) - sourceWidth / 2;
      const sourceY = canvas.height / 2 - view.y / (coverScale * view.zoom) - sourceHeight / 2;
      const output = document.createElement('canvas');
      output.width = Math.max(1, Math.round(sourceWidth));
      output.height = Math.max(1, Math.round(sourceHeight));
      const context = output.getContext('2d');
      if (!context) throw new Error('Could not create a crop canvas.');
      context.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, output.width, output.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        output.toBlob((result) => {
          if (!result) {
            reject(new Error('Could not export the crop.'));
            return;
          }
          resolve(result);
        }, 'image/jpeg', 0.92);
      });
      outputUrl = URL.createObjectURL(blob);
      await onSave(outputUrl);
    } catch (error) {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      console.error('Story crop export failed:', error);
      setSaveError(error instanceof Error ? error.message : 'Could not export the crop. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" style={{ height: '100dvh' }}>
      <div
        className="flex shrink-0 items-center justify-between px-4 pb-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close crop editor">
          <X className="h-6 w-6 text-white" />
        </Button>
        <span className="font-medium">Crop</span>
        <Button variant="ghost" size="icon" onClick={handleSave} disabled={!loaded || saving || !stageSize.width} aria-label="Save crop">
          <Check className="h-6 w-6 text-white" />
        </Button>
      </div>

      <div ref={viewportRef} className="flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden px-4 py-2">
        <div
          className="relative shrink-0 touch-none overflow-hidden bg-neutral-900"
          style={{
            width: stageSize.width,
            height: stageSize.height,
            maxWidth: '100%',
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            style={{
              objectFit: 'cover',
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
              transformOrigin: 'center',
              pointerEvents: 'none',
            }}
          />
          {!loaded && !saveError && <div className="absolute inset-0 animate-pulse bg-white/10" />}
        </div>
      </div>

      <div
        className="shrink-0 space-y-3 px-4 pt-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
      >
        {saveError && <p role="alert" className="text-center text-sm text-red-400">{saveError}</p>}
        <p className="text-center text-xs text-white/65">Drag to move · Pinch or slide to zoom</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => handleZoomChange(view.zoom - 0.25)} aria-label="Zoom out" disabled={!loaded || saving || view.zoom <= MIN_ZOOM}>
            <Minus className="h-5 w-5" />
          </Button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={view.zoom}
            onChange={(event) => handleZoomChange(Number(event.target.value))}
            aria-label="Crop zoom"
            className="w-44 accent-white"
            disabled={!loaded || saving}
          />
          <Button variant="ghost" size="icon" onClick={() => handleZoomChange(view.zoom + 0.25)} aria-label="Zoom in" disabled={!loaded || saving || view.zoom >= MAX_ZOOM}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex justify-center gap-2">
          {aspectRatios.map((item) => (
            <Button
              key={item.id}
              variant={selectedRatio === item.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedRatio(item.id)}
              aria-pressed={selectedRatio === item.id}
              disabled={!loaded || saving}
              className={selectedRatio !== item.id ? 'text-white/70' : ''}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex justify-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => setRotation((value) => (value + 90) % 360)} aria-label="Rotate image" disabled={!loaded || saving}>
            <RotateCw className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setFlipH((value) => !value)} aria-label="Flip horizontally" disabled={!loaded || saving}>
            <FlipHorizontal className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setFlipV((value) => !value)} aria-label="Flip vertically" disabled={!loaded || saving}>
            <FlipVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
