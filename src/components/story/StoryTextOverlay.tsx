import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, AlignLeft, AlignCenter, AlignRight, Check } from 'lucide-react';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontFamily: string;
  align: 'left' | 'center' | 'right';
  fontPreset?: string;
  hasBgPill?: boolean;
}

interface StoryTextOverlayProps {
  overlay: TextOverlay;
  onUpdate: (overlay: TextOverlay) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  onEditComplete: () => void;
}

const colors = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00',
  '#34C759', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55'
];

const fonts = [
  { id: 'sans',    name: 'Modern',   family: 'ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { id: 'serif',   name: 'Classic',  family: 'ui-serif, Georgia, "Times New Roman", serif' },
  { id: 'neon',    name: 'Neon',     family: 'ui-sans-serif, system-ui, sans-serif' },
  { id: 'cursive', name: 'Elegant',  family: '"Dancing Script", "Brush Script MT", cursive' },
  { id: 'mono',    name: 'Mono',     family: 'ui-monospace, "SF Mono", monospace' },
];

const presetExtraStyle = (preset?: string, color?: string): React.CSSProperties => {
  if (preset === 'neon') {
    return {
      fontWeight: 900,
      letterSpacing: '0.04em',
      textShadow: `0 0 8px ${color || '#fff'}, 0 0 16px ${color || '#fff'}, 2px 2px 4px rgba(0,0,0,0.45)`,
    };
  }
  if (preset === 'cursive') {
    return { fontWeight: 600 };
  }
  return { textShadow: '2px 2px 4px rgba(0,0,0,0.5)' };
};

export const StoryTextOverlay = ({
  overlay,
  onUpdate,
  onDelete,
  isEditing,
  onEditComplete
}: StoryTextOverlayProps) => {
  const [text, setText] = useState(overlay.text);
  const [color, setColor] = useState(overlay.color);
  const [fontSize, setFontSize] = useState(overlay.fontSize);
  const [fontFamily, setFontFamily] = useState(overlay.fontFamily);
  const [fontPreset, setFontPreset] = useState<string>(overlay.fontPreset || 'sans');
  const [hasBgPill, setHasBgPill] = useState<boolean>(!!overlay.hasBgPill);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>(overlay.align);

  const handleSave = () => {
    onUpdate({
      ...overlay,
      text,
      color,
      fontSize,
      fontFamily,
      fontPreset,
      hasBgPill,
      align
    });
    onEditComplete();
  };

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => onDelete(overlay.id)}>
            <X className="h-6 w-6 text-white" />
          </Button>
          <span className="text-white font-medium">Edit Text</span>
          <Button variant="ghost" size="icon" onClick={handleSave}>
            <Check className="h-6 w-6 text-white" />
          </Button>
        </div>

        {/* Text Preview */}
        <div className="flex-1 flex items-center justify-center p-8">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type something..."
            className="bg-transparent border-none text-center text-3xl focus-visible:ring-0"
            style={{
              color,
              fontFamily,
              fontSize: `${fontSize}px`,
              textAlign: align
            }}
            autoFocus
          />
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4">
          {/* Alignment */}
          <div className="flex justify-center gap-2">
            {[
              { value: 'left', icon: AlignLeft },
              { value: 'center', icon: AlignCenter },
              { value: 'right', icon: AlignRight },
            ].map(({ value, icon: Icon }) => (
              <Button
                key={value}
                variant={align === value ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setAlign(value as 'left' | 'center' | 'right')}
                className="text-white"
              >
                <Icon className="h-5 w-5" />
              </Button>
            ))}
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-4 justify-center">
            <span className="text-white text-sm">Size</span>
            <input
              type="range"
              min={16}
              max={72}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-48 accent-primary"
            />
          </div>

          {/* Fonts */}
          <div className="flex gap-2 justify-center overflow-x-auto pb-1">
            {fonts.map((font) => (
              <Button
                key={font.id}
                variant={fontPreset === font.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setFontPreset(font.id);
                  setFontFamily(font.family);
                }}
                style={{ fontFamily: font.family }}
                className="text-white border-white/30 flex-shrink-0"
              >
                {font.name}
              </Button>
            ))}
          </div>

          {/* Background pill toggle */}
          <div className="flex justify-center">
            <Button
              variant={hasBgPill ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHasBgPill((v) => !v)}
              className="text-white border-white/30"
            >
              {hasBgPill ? 'Pill background ON' : 'Pill background OFF'}
            </Button>
          </div>

          {/* Colors */}
          <div className="flex gap-2 justify-center">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 ${
                  color === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute cursor-move select-none"
      style={{
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        transform: 'translate(-50%, -50%)',
        color: overlay.color,
        fontFamily: overlay.fontFamily,
        fontSize: `${overlay.fontSize}px`,
        textAlign: overlay.align,
        maxWidth: '80%',
        wordBreak: 'break-word',
        ...presetExtraStyle(overlay.fontPreset, overlay.color),
      }}
    >
      {overlay.hasBgPill ? (
        <span
          className="px-3 py-1 rounded-full backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          {overlay.text}
        </span>
      ) : (
        overlay.text
      )}
    </div>
  );
};
