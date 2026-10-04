import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { X, Check } from 'lucide-react';

export interface AdjustmentValues {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  fade: number;
  vignette: number;
}

export const defaultAdjustments: AdjustmentValues = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  fade: 0,
  vignette: 0,
};

export const adjustmentsToCss = (adj: AdjustmentValues): string => {
  const parts: string[] = [];
  if (adj.brightness !== 100) parts.push(`brightness(${adj.brightness}%)`);
  if (adj.contrast !== 100) parts.push(`contrast(${adj.contrast}%)`);
  if (adj.saturation !== 100) parts.push(`saturate(${adj.saturation}%)`);
  if (adj.warmth > 0) parts.push(`sepia(${adj.warmth}%)`);
  if (adj.fade > 0) parts.push(`opacity(${100 - adj.fade * 0.5}%)`);
  return parts.length ? parts.join(' ') : 'none';
};

interface StoryAdjustmentsProps {
  values: AdjustmentValues;
  onChange: (values: AdjustmentValues) => void;
  onClose: () => void;
}

const sliders: { key: keyof AdjustmentValues; label: string; min: number; max: number; default: number }[] = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150, default: 100 },
  { key: 'contrast', label: 'Contrast', min: 50, max: 150, default: 100 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200, default: 100 },
  { key: 'warmth', label: 'Warmth', min: 0, max: 50, default: 0 },
  { key: 'fade', label: 'Fade', min: 0, max: 50, default: 0 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100, default: 0 },
];

export const StoryAdjustments = ({ values, onChange, onClose }: StoryAdjustmentsProps) => {
  const [local, setLocal] = useState<AdjustmentValues>(values);

  const handleChange = (key: keyof AdjustmentValues, val: number) => {
    const updated = { ...local, [key]: val };
    setLocal(updated);
    onChange(updated);
  };

  const handleReset = () => {
    setLocal(defaultAdjustments);
    onChange(defaultAdjustments);
  };

  return (
    <div className="bg-black/95 rounded-t-2xl p-4 space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-white/70 text-xs">
          Reset
        </Button>
        <span className="text-white font-medium text-sm">Adjust</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <Check className="h-5 w-5 text-white" />
        </Button>
      </div>

      {sliders.map((s) => (
        <div key={s.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-xs">{s.label}</span>
            <span className="text-white/50 text-xs">{local[s.key]}</span>
          </div>
          <Slider
            min={s.min}
            max={s.max}
            step={1}
            value={[local[s.key]]}
            onValueChange={([v]) => handleChange(s.key, v)}
            className="w-full"
          />
        </div>
      ))}
    </div>
  );
};
