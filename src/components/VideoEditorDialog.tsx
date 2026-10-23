import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Plus, Trash2, Loader2 } from 'lucide-react';
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
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [regions, setRegions] = useState<BlurRegion[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setRegions([]); setSelected(null); setPlaying(false); setNow(0); setProgress(0); setExporting(false);
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
    } else v.pause();
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setNow(t);
  };

  const onRange = (val: number[]) => {
    const next: [number, number] = [val[0], val[1]];
    // Scrub the preview to whichever handle moved.
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

  // Drag / resize a blur region on the preview
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
  const unchanged = regions.length === 0 && range[0] <= 0.05 && range[1] >= duration - 0.05;

  const save = async () => {
    if (!file) return;
    if (unchanged) { onDone(file); onOpenChange(false); return; }
    if (!canEditVideo()) {
      toast({ title: 'Editing not supported', description: 'This device cannot edit videos in the app.', variant: 'destructive' });
      return;
    }
    videoRef.current?.pause();
    setExporting(true); setProgress(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const edited = await exportEditedVideo(file, { start: range[0], end: range[1], regions }, setProgress, ac.signal);
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!exporting) onOpenChange(o); }}>
      <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto p-4">
        <DialogHeader><DialogTitle>Edit video</DialogTitle></DialogHeader>

        <div
          ref={stageRef}
          className="relative mx-auto w-full overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: aspect, maxHeight: '48dvh' }}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onClick={() => setSelected(null)}
        >
          {url && (
            <video
              ref={videoRef}
              src={url}
              playsInline
              className="h-full w-full"
              onLoadedMetadata={onMeta}
              onTimeUpdate={onTime}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          )}
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
                  className="absolute -bottom-2 -right-2 h-5 w-5 rounded-full border-2 border-white bg-primary touch-none"
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Button size="icon" variant="secondary" className="rounded-full" onClick={togglePlay} disabled={exporting}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1">
            <Slider value={range} min={0} max={duration || 1} step={0.1} minStepsBetweenThumbs={1} onValueChange={onRange} disabled={exporting || !duration} />
            <div className="mt-1 flex justify-between text-[11px] tabular-nums text-muted-foreground">
              <span>Start {fmt(range[0])}</span>
              <span>{fmt(range[1] - range[0])} kept</span>
              <span>End {fmt(range[1])}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Blur sections</p>
            <Button size="sm" variant="outline" onClick={addRegion} disabled={exporting}>
              <Plus className="mr-1 h-4 w-4" />Add blur
            </Button>
          </div>
          {regions.length === 0 && (
            <p className="text-xs text-muted-foreground">Add a blur box, then drag it over what you want hidden and pull its corner to resize.</p>
          )}
          {sel && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Blur visible {fmt(sel.from)} – {fmt(sel.to)}</span>
                <button
                  className="inline-flex items-center gap-1 text-destructive"
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
              />
            </div>
          )}
          {regions.length > 0 && !sel && <p className="text-xs text-muted-foreground">Tap a blur box to set when it appears.</p>}
        </div>

        {exporting && (
          <div className="space-y-1">
            <Progress value={progress * 100} />
            <p className="text-xs text-muted-foreground">Rendering your video — keep this open ({Math.round(progress * 100)}%)</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          {exporting ? (
            <Button variant="outline" onClick={cancelExport}>Cancel</Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          )}
          <Button onClick={save} disabled={exporting || !duration}>
            {exporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {unchanged ? 'Done' : 'Apply edits'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
