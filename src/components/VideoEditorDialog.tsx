import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Play, Pause, Plus, Trash2, Loader2, X, Scissors, Crop, Focus,
  Type, Music, Captions, Sticker
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { exportEditedVideo, canEditVideo, type BlurRegion } from '@/lib/videoEdit';

interface Props {
  file: File | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the edited file (or the original when nothing was changed). */
  onDone: (edited: File) => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
let idCounter = 0;

export const VideoEditorDialog = ({ file, open, onOpenChange, onDone }: Props) => {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [aspect, setAspect] = useState(9 / 16);
  const [cropAspect, setCropAspect] = useState<number | null>(null);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [regions, setRegions] = useState<BlurRegion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTool, setActiveTool] = useState<'trim' | 'crop' | 'blur' | null>('trim');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setCropAspect(null);
    setRegions([]);
    setSelected(null);
    setPlaying(false);
    setNow(0);
    setProgress(0);
    setExporting(false);
    setActiveTool('trim');
  }, [open, file]);

  const onMeta = () => {
    const v = videoRef.current!;
    const d = isFinite(v.duration) ? v.duration : 0;
    setDuration(d);
    setRange([0, d]);
    if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
  };

  const onTime = () => {
    const v = videoRef.current!;
    setNow(v.currentTime);
    if (v.currentTime >= range[1] - 0.03) {
      v.pause();
      v.currentTime = range[0];
    }
  };

  const togglePlay = () => {
    const v = videoRef.current!;
    if (v.paused) {
      if (v.currentTime < range[0] || v.currentTime >= range[1] - 0.05) v.currentTime = range[0];
      v.play();
    } else {
      v.pause();
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setNow(t);
  };

  const onRange = (val: number[]) => {
    const next: [number, number] = [val[0], val[1]];
    seek(val[0] !== range[0] ? val[0] : Math.max(val[0], val[1] - 0.05));
    setRange(next);
  };

  const addRegion = () => {
    const id = `r${++idCounter}`;
    setRegions((r) => [...r, { id, x: 0.3, y: 0.35, w: 0.4, h: 0.25, from: range[0], to: range[1] }]);
    setSelected(id);
  };

  const patch = (id: string, p: Partial<BlurRegion>) =>
    setRegions((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; orig: BlurRegion } | null>(null);

  const startDrag = (e: React.PointerEvent, r: BlurRegion, mode: 'move' | 'resize') => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(r.id);
    dragRef.current = { id: r.id, mode, sx: e.clientX, sy: e.clientY, orig: r };
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const box = stageRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.sx) / box.width;
    const dy = (e.clientY - d.sy) / box.height;
    const o = d.orig;
    if (d.mode === 'move') {
      patch(d.id, {
        x: Math.min(1 - o.w, Math.max(0, o.x + dx)),
        y: Math.min(1 - o.h, Math.max(0, o.y + dy)),
      });
    } else {
      patch(d.id, {
        w: Math.min(1 - o.x, Math.max(0.08, o.w + dx)),
        h: Math.min(1 - o.y, Math.max(0.08, o.h + dy)),
      });
    }
  };

  const endDrag = () => { dragRef.current = null; };

  const sel = regions.find((r) => r.id === selected) || null;
  const unchanged = !cropAspect && regions.length === 0 && range[0] <= 0.05 && range[1] >= duration - 0.05;

  const save = async () => {
    if (!file) return;
    if (unchanged) { onDone(file); onOpenChange(false); return; }
    if (!canEditVideo()) {
      toast({ title: 'Editing not supported', description: 'This device cannot edit videos in the app.', variant: 'destructive' });
      return;
    }
    videoRef.current?.pause();
    setExporting(true);
    setProgress(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const edited = await exportEditedVideo(file, { start: range[0], end: range[1], regions, cropAspect }, setProgress, ac.signal);
      onDone(edited);
      onOpenChange(false);
    } catch (err) {
      if ((err as Error).message !== 'cancelled') {
        toast({ title: 'Could not edit video', description: (err as Error).message || 'Try a shorter clip.', variant: 'destructive' });
      }
    } finally {
      setExporting(false);
      abortRef.current = null;
    }
  };

  const cancelExport = () => abortRef.current?.abort();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white" style={{ height: '100dvh' }}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-10 w-10" onClick={() => onOpenChange(false)} disabled={exporting}>
          <X className="h-6 w-6" />
        </Button>
        <span className="font-semibold text-base tracking-wide">Edit video</span>
        <Button size="sm" className="rounded-full bg-white text-black hover:bg-white/90 font-semibold px-5 h-9" onClick={save} disabled={exporting || !duration}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : (unchanged ? 'Done' : 'Next')}
        </Button>
      </div>

      {/* Video Stage */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-4">
        <div
          ref={stageRef}
          className="relative overflow-hidden rounded-xl bg-black shadow-2xl"
          style={{ aspectRatio: cropAspect ?? aspect, maxHeight: '100%', maxWidth: '100%' }}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onClick={() => setSelected(null)}
        >
          {url && (
            <video
              ref={videoRef}
              src={url}
              playsInline
              className="h-full w-full object-cover"
              onLoadedMetadata={onMeta}
              onTimeUpdate={onTime}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          )}
          {/* Blur regions rendering */}
          {regions.map((r) => {
            const active = now >= r.from && now <= r.to;
            return (
              <div
                key={r.id}
                onPointerDown={(e) => startDrag(e, r, 'move')}
                className={cn(
                  'absolute touch-none border-2',
                  selected === r.id ? 'border-primary' : 'border-white/70 border-dashed',
                  active && 'backdrop-blur-lg bg-white/5'
                )}
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
              >
                <div
                  onPointerDown={(e) => startDrag(e, r, 'resize')}
                  className="absolute -bottom-2 -right-2 h-5 w-5 rounded-full border-2 border-white bg-primary touch-none shadow-md"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline Control */}
      <div className="px-4 py-2 shrink-0">
        <div className="flex items-center gap-4">
          <Button size="icon" className="bg-white/10 hover:bg-white/20 text-white rounded-full h-11 w-11 shrink-0" onClick={togglePlay} disabled={exporting}>
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </Button>
          <div className="flex-1">
            <Slider
              value={range}
              min={0}
              max={duration || 1}
              step={0.1}
              minStepsBetweenThumbs={1}
              onValueChange={onRange}
              disabled={exporting || !duration}
              className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_.bg-primary]:bg-white [&_.bg-secondary]:bg-white/20"
            />
            <div className="mt-2 flex justify-between text-[11px] text-white/60 tabular-nums">
              <span>{fmt(range[0])}</span>
              <span className="text-white font-medium">{fmt(range[1] - range[0])} kept</span>
              <span>{fmt(range[1])}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Tool Panel */}
      <div className="px-4 pb-2 min-h-[140px] shrink-0">
        {activeTool === 'crop' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Crop</p>
            <div className="flex flex-wrap gap-2">
              {([['Original', null], ['9:16', 9 / 16], ['1:1', 1], ['4:5', 4 / 5], ['16:9', 16 / 9]] as const).map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  disabled={exporting}
                  onClick={() => setCropAspect(value)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-xs font-medium transition-colors',
                    cropAspect === value ? 'border-white bg-white text-black' : 'border-white/20 text-white/80 hover:bg-white/10'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTool === 'blur' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Blur Sections</p>
              <Button size="sm" variant="outline" className="h-7 text-xs border-white/20 text-white hover:bg-white/10 rounded-full" onClick={addRegion} disabled={exporting}>
                <Plus className="mr-1 h-3 w-3" />Add Blur
              </Button>
            </div>
            {regions.length === 0 && (
              <p className="text-xs text-white/50 leading-relaxed">Add a blur box, then drag it over what you want hidden and pull its corner to resize.</p>
            )}
            {sel && (
              <div className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>Visible: {fmt(sel.from)} – {fmt(sel.to)}</span>
                  <button
                    className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
                    onClick={() => { setRegions((rs) => rs.filter((r) => r.id !== sel.id)); setSelected(null); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />Remove
                  </button>
                </div>
                <Slider
                  value={[sel.from, sel.to]}
                  min={range[0]}
                  max={range[1] || 1}
                  step={0.1}
                  onValueChange={(v) => { patch(sel.id, { from: v[0], to: v[1] }); seek(v[0]); }}
                  disabled={exporting}
                  className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:border-2 [&_[role=slider]]:border-white [&_.bg-primary]:bg-white [&_.bg-secondary]:bg-white/20"
                />
              </div>
            )}
            {regions.length > 0 && !sel && <p className="text-xs text-white/50">Tap a blur box to set when it appears.</p>}
          </div>
        )}

        {activeTool === 'trim' && (
          <div className="flex items-center justify-center h-full animate-in fade-in">
            <p className="text-xs text-white/50 text-center">Drag the handles on the timeline to trim your video.</p>
          </div>
        )}
      </div>

      {/* Bottom Toolbar */}
      <div className="flex items-center gap-6 px-4 py-3 overflow-x-auto shrink-0 bg-black/60" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
        <ToolBtn icon={Scissors} label="Trim" active={activeTool === 'trim'} onClick={() => setActiveTool('trim')} />
        <ToolBtn icon={Crop} label="Crop" active={activeTool === 'crop'} onClick={() => setActiveTool('crop')} />
        <ToolBtn icon={Focus} label="Blur" active={activeTool === 'blur'} onClick={() => setActiveTool('blur')} />

        {/* Future placeholders */}
        <ToolBtn icon={Music} label="Audio" disabled />
        <ToolBtn icon={Type} label="Text" disabled />
        <ToolBtn icon={Captions} label="Captions" disabled />
        <ToolBtn icon={Sticker} label="Stickers" disabled />
      </div>

      {/* Exporting Overlay */}
      {exporting && (
        <div className="absolute inset-0 z-[110] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md">
          <Loader2 className="h-10 w-10 animate-spin text-white mb-6" />
          <p className="text-white font-semibold text-lg mb-2">Rendering video...</p>
          <p className="text-white/60 text-sm mb-6 text-center">Keep this screen open until it finishes.</p>
          <Progress value={progress * 100} className="w-full max-w-xs mb-2 h-2" />
          <p className="text-white/80 text-sm mb-8 font-medium">{Math.round(progress * 100)}%</p>
          <Button variant="outline" className="text-white border-white/20 hover:bg-white/10 px-8 rounded-full" onClick={cancelExport}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

// Helper component for toolbar buttons
const ToolBtn = ({ icon: Icon, label, active, disabled, onClick }: { icon: any, label: string, active?: boolean, disabled?: boolean, onClick?: () => void }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex flex-col items-center gap-1.5 text-[10px] font-medium tracking-wide transition-colors shrink-0",
      disabled ? "text-white/30 cursor-not-allowed" : active ? "text-white" : "text-white/60 hover:text-white"
    )}
  >
    <div className={cn("p-2.5 rounded-full transition-colors", active ? "bg-white/20" : "bg-transparent")}>
      <Icon className="h-6 w-6" />
    </div>
    {label}
  </button>
);