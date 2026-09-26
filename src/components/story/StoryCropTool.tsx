import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Check, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react';

interface StoryCropToolProps {
  imageUrl: string;
  onSave: (croppedUrl: string) => void | Promise<void>;
  onClose: () => void;
}

const aspectRatios = [
  { id: 'free', label: 'Free', value: null },
  { id: '9:16', label: '9:16', value: 9 / 16 },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:5', label: '4:5', value: 4 / 5 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
];

export const StoryCropTool = ({ imageUrl, onSave, onClose }: StoryCropToolProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState('free');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setLoaded(true);
      drawImage(img, rotation, flipH, flipV);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (imgRef.current && loaded) {
      drawImage(imgRef.current, rotation, flipH, flipV);
    }
  }, [rotation, flipH, flipV, loaded]);

  const drawImage = (img: HTMLImageElement, rot: number, fh: boolean, fv: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isRotated = rot % 180 !== 0;
    const w = isRotated ? img.height : img.width;
    const h = isRotated ? img.width : img.height;

    canvas.width = w;
    canvas.height = h;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(fh ? -1 : 1, fv ? -1 : 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  };

  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleFlipH = () => setFlipH((f) => !f);
  const handleFlipV = () => setFlipV((f) => !f);

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const ratio = aspectRatios.find((r) => r.id === selectedRatio)?.value;
      if (!ratio) {
        await onSave(canvas.toDataURL('image/jpeg', 0.92));
        return;
      }

      const outCanvas = document.createElement('canvas');
      const ctx = outCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not create a crop canvas.');

      let cropW = canvas.width;
      let cropH = canvas.height;
      let cropX = 0;
      let cropY = 0;

      if (canvas.width / canvas.height > ratio) {
        cropW = canvas.height * ratio;
        cropX = (canvas.width - cropW) / 2;
      } else {
        cropH = canvas.width / ratio;
        cropY = (canvas.height - cropH) / 2;
      }

      outCanvas.width = cropW;
      outCanvas.height = cropH;
      ctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      await onSave(outCanvas.toDataURL('image/jpeg', 0.92));
    } catch (err) {
      console.error('Story crop export failed:', err);
      setSaveError(err instanceof Error ? err.message : 'Could not export the crop. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-6 w-6 text-white" />
        </Button>
        <span className="text-white font-medium">Crop</span>
        <Button variant="ghost" size="icon" onClick={handleSave} disabled={!loaded || saving} aria-label="Save crop">
          <Check className="h-6 w-6 text-white" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain rounded-lg"
          style={{ maxHeight: 'calc(100vh - 220px)' }}
        />
      </div>

      <div className="p-4 space-y-4">
        {saveError && <p role="alert" className="text-center text-sm text-red-400">{saveError}</p>}
        <div className="flex justify-center gap-6">
          <Button variant="ghost" size="icon" onClick={handleRotate} className="text-white" disabled={!loaded || saving}>
            <RotateCw className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleFlipH} className="text-white" disabled={!loaded || saving}>
            <FlipHorizontal className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleFlipV} className="text-white" disabled={!loaded || saving}>
            <FlipVertical className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex gap-2 justify-center">
          {aspectRatios.map((r) => (
            <Button
              key={r.id}
              variant={selectedRatio === r.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedRatio(r.id)}
              aria-pressed={selectedRatio === r.id}
              disabled={!loaded || saving}
              className={selectedRatio !== r.id ? 'text-white/70' : ''}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
