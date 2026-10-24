import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Crop, Loader2, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { storyFilters } from '@/components/showcase/StoryFilters';
import { StoryAdjustments, defaultAdjustments, type AdjustmentValues } from '@/components/showcase/StoryAdjustments';
import { StoryCropTool } from '@/components/showcase/StoryCropTool';
import { photoFilterCss, renderEditedPhoto } from '@/lib/photoEdit';

interface Props {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onDone: (edited: File) => void;
}

type Tool = null | 'looks' | 'adjust';

/** Full-screen photo editor for posts: crop / rotate / flip, looks, adjustments — same tools as Showcase. */
export const PhotoEditorDialog = ({ file, open, onClose, onDone }: Props) => {
  const [working, setWorking] = useState<File | null>(file);
  const [filterId, setFilterId] = useState('none');
  const [adj, setAdj] = useState<AdjustmentValues>(defaultAdjustments);
  const [tool, setTool] = useState<Tool>(null);
  const [cropping, setCropping] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWorking(file); setFilterId('none'); setAdj(defaultAdjustments); setTool(null); setCropping(false);
  }, [open, file]);

  const url = useMemo(() => (working ? URL.createObjectURL(working) : ''), [working]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (!open || !working) return null;

  const css = photoFilterCss(filterId, adj);
  const dirty = working !== file || filterId !== 'none' || JSON.stringify(adj) !== JSON.stringify(defaultAdjustments);

  const onCropSave = async (croppedUrl: string) => {
    const res = await fetch(croppedUrl);
    const blob = await res.blob();
    setWorking(new File([blob], working.name.replace(/\.[^.]+$/, '') + '.jpg', { type: blob.type || 'image/jpeg' }));
    setCropping(false);
  };

  const save = async () => {
    if (!dirty) { onClose(); return; }
    setSaving(true);
    try {
      const edited = await renderEditedPhoto(working, css, adj.vignette, working.name);
      onDone(edited);
      onClose();
    } catch (err) {
      toast({ title: 'Could not save edits', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (cropping) return <StoryCropTool imageUrl={url} onSave={onCropSave} onClose={() => setCropping(false)} />;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" style={{ height: '100dvh' }}>
      <div className="flex shrink-0 items-center justify-between px-4 pb-3" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cancel editing"><X className="h-6 w-6 text-white" /></Button>
        <span className="font-medium">Edit photo</span>
        <Button variant="ghost" size="icon" onClick={save} disabled={saving} aria-label="Save edits">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-6 w-6 text-white" />}
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2">
        <div className="relative max-h-full max-w-full">
          <img src={url} alt="" className="max-h-[62dvh] max-w-full rounded-lg object-contain" style={{ filter: css }} draggable={false} />
          {adj.vignette > 0 && (
            <div
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{ background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${adj.vignette / 100}) 100%)` }}
            />
          )}
        </div>
      </div>

      {tool === 'looks' && (
        <div className="shrink-0 bg-black/95 px-3 py-3">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {storyFilters.map((f) => (
              <button key={f.id} onClick={() => setFilterId(f.id)} className="flex flex-shrink-0 flex-col items-center gap-1" aria-pressed={filterId === f.id}>
                <div className={cn('h-16 w-16 overflow-hidden rounded-lg border-2', filterId === f.id ? 'border-primary ring-2 ring-primary/40' : 'border-white/20')}>
                  <img src={url} alt="" className="h-full w-full object-cover" style={{ filter: f.css }} draggable={false} />
                </div>
                <span className={cn('text-[11px]', filterId === f.id ? 'font-semibold text-primary' : 'text-white/70')}>{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {tool === 'adjust' && <StoryAdjustments values={adj} onChange={setAdj} onClose={() => setTool(null)} />}

      <div className="shrink-0 border-t border-white/10 bg-[#09070f] px-4 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <div className="mx-auto flex max-w-sm justify-around">
          {([
            ['Crop', Crop, () => setCropping(true), false],
            ['Looks', Sparkles, () => setTool(tool === 'looks' ? null : 'looks'), tool === 'looks'],
            ['Adjust', SlidersHorizontal, () => setTool(tool === 'adjust' ? null : 'adjust'), tool === 'adjust'],
          ] as const).map(([label, Icon, onClick, active]) => (
            <button key={label} onClick={onClick} className={cn('flex flex-col items-center gap-1 rounded-xl px-5 py-2 text-xs', active ? 'bg-white/15' : 'hover:bg-white/10')}>
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
