import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  X, Type, Smile, Image as ImageIcon, Send, Loader2,
  Paintbrush, Crop, SlidersHorizontal, Sparkles, Users,
  Video, ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { storyFilters } from '@/components/story/StoryFilters';
import { StoryStickerPicker, StickerDisplay, Sticker } from '@/components/story/StoryStickers';
import { StoryTextOverlay } from '@/components/story/StoryTextOverlay';
import { StoryDrawing } from '@/components/story/StoryDrawing';
import { StoryAudienceSelector, StoryAudience } from '@/components/story/StoryAudienceSelector';
import { StoryCropTool } from '@/components/story/StoryCropTool';
import { StoryAdjustments, AdjustmentValues, defaultAdjustments, adjustmentsToCss } from '@/components/story/StoryAdjustments';
import { cn } from '@/lib/utils';

interface TextOverlayItem {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontFamily: string;
  align: 'left' | 'center' | 'right';
}

const textBackgrounds = [
  { id: 'g1', bg: 'linear-gradient(135deg,#6366f1,#ec4899)' },
  { id: 'g2', bg: 'linear-gradient(135deg,#0ea5e9,#22d3ee)' },
  { id: 'g3', bg: 'linear-gradient(135deg,#f97316,#ef4444)' },
  { id: 'g4', bg: 'linear-gradient(135deg,#10b981,#34d399)' },
  { id: 'g5', bg: 'linear-gradient(135deg,#111827,#1f2937)' },
  { id: 'g6', bg: 'linear-gradient(135deg,#fbbf24,#f97316)' },
  { id: 'g7', bg: 'linear-gradient(135deg,#a855f7,#3b82f6)' },
];

type Tool = null | 'filters' | 'adjust' | 'stickers' | 'crop' | 'draw' | 'audience' | 'textEdit';

const CreateStoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Source
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'text'>('text');

  // Text-only story
  const [storyText, setStoryText] = useState('');
  const [textBg, setTextBg] = useState(textBackgrounds[0]);

  // Editor
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [adjustments, setAdjustments] = useState<AdjustmentValues>(defaultAdjustments);
  const [textOverlays, setTextOverlays] = useState<TextOverlayItem[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [drawingUrl, setDrawingUrl] = useState<string | null>(null);
  const [audience, setAudience] = useState<StoryAudience>('public');

  // UI
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [uploading, setUploading] = useState(false);

  // File select
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 50MB', variant: 'destructive' });
      return;
    }
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      toast({ title: 'Invalid file', variant: 'destructive' });
      return;
    }
    setMediaFile(f);
    setMediaPreview(URL.createObjectURL(f));
    setMediaType(f.type.startsWith('video/') ? 'video' : 'image');
  };

  // Cleanup blob url
  useEffect(() => {
    return () => {
      if (mediaPreview && mediaPreview.startsWith('blob:')) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  const filterCss = (() => {
    const f = storyFilters.find(x => x.id === selectedFilter)?.css || 'none';
    const a = adjustmentsToCss(adjustments);
    if (f === 'none' && a === 'none') return 'none';
    if (f === 'none') return a;
    if (a === 'none') return f;
    return `${f} ${a}`;
  })();

  // Drag helpers (percent-based relative to canvas)
  const dragRef = useRef<{ id: string; kind: 'text' | 'sticker'; offX: number; offY: number } | null>(null);
  const beginDrag = (id: string, kind: 'text' | 'sticker') => (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id, kind, offX: 0, offY: 0 };
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    const { id, kind } = dragRef.current;
    if (kind === 'text') {
      setTextOverlays(prev => prev.map(o => o.id === id ? { ...o, x, y } : o));
    } else {
      setStickers(prev => prev.map(s => s.id === id ? { ...s, x, y } : s));
    }
  };
  const endDrag = () => { dragRef.current = null; };

  // Text
  const addText = () => {
    const n: TextOverlayItem = {
      id: Date.now().toString(),
      text: 'Tap to edit',
      x: 50, y: 50,
      color: '#FFFFFF',
      fontSize: 32,
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      align: 'center',
    };
    setTextOverlays(prev => [...prev, n]);
    setEditingTextId(n.id);
    setActiveTool('textEdit');
  };

  const addSticker = (s: Omit<Sticker, 'id' | 'x' | 'y'>) => {
    setStickers(prev => [...prev, { ...s, id: Date.now().toString(), x: 50, y: 40 + Math.random() * 20 }]);
    setActiveTool(null);
  };

  const onCropSave = (url: string) => {
    setMediaPreview(url);
    fetch(url).then(r => r.blob()).then(b => setMediaFile(new File([b], 'cropped.jpg', { type: 'image/jpeg' })));
    setActiveTool(null);
  };

  // Composite image+filters+overlays into a single File for upload
  const compositeImage = async (): Promise<File | null> => {
    if (mediaType !== 'image' || !mediaPreview) return mediaFile;
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = mediaPreview;
      });
      const W = img.naturalWidth || 1080;
      const H = img.naturalHeight || 1920;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return mediaFile;
      if (filterCss !== 'none') (ctx as any).filter = filterCss;
      ctx.drawImage(img, 0, 0, W, H);
      (ctx as any).filter = 'none';

      // Vignette
      if (adjustments.vignette > 0) {
        const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.7);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${adjustments.vignette / 100})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // Drawing
      if (drawingUrl) {
        const d = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.onload = () => res(i); i.onerror = rej; i.src = drawingUrl;
        });
        ctx.drawImage(d, 0, 0, W, H);
      }

      // Text overlays
      textOverlays.forEach(o => {
        ctx.save();
        ctx.fillStyle = o.color;
        ctx.font = `bold ${(o.fontSize / 360) * H}px ${o.fontFamily}`;
        ctx.textAlign = o.align as CanvasTextAlign;
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.fillText(o.text, (o.x / 100) * W, (o.y / 100) * H);
        ctx.restore();
      });

      // Stickers (emoji only, others kept simple)
      stickers.forEach(s => {
        if (s.type === 'emoji') {
          ctx.save();
          ctx.font = `${(60 / 360) * H}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(s.data.emoji, (s.x / 100) * W, (s.y / 100) * H);
          ctx.restore();
        }
      });

      return await new Promise<File | null>(resolve => {
        canvas.toBlob(b => {
          if (!b) return resolve(mediaFile);
          resolve(new File([b], 'story.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.92);
      });
    } catch (err) {
      console.warn('Composite failed, using original', err);
      return mediaFile;
    }
  };

  const handleShare = async () => {
    if (!user) return;
    if (mediaType === 'text' && !storyText.trim()) {
      toast({ title: 'Type something first', variant: 'destructive' });
      return;
    }
    if (mediaType !== 'text' && !mediaFile) {
      toast({ title: 'Pick a photo or video first', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      let media_url: string | null = null;
      let media_type: string | null = null;
      let content: string | null = null;

      if (mediaType === 'text') {
        content = storyText;
      } else {
        const fileToUpload = mediaType === 'image' ? await compositeImage() : mediaFile;
        if (!fileToUpload) throw new Error('No file');
        const ext = (fileToUpload.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('stories').upload(path, fileToUpload, {
          cacheControl: '3600', upsert: false,
        });
        if (upErr) {
          // Fallback to posts bucket if stories bucket doesn't exist
          const { error: upErr2 } = await supabase.storage.from('posts').upload(path, fileToUpload, {
            cacheControl: '3600', upsert: false,
          });
          if (upErr2) throw upErr;
          const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(path);
          media_url = publicUrl;
        } else {
          const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(path);
          media_url = publicUrl;
        }
        media_type = mediaType;
      }

      const { error: insErr } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url,
        media_type,
        content,
      });
      if (insErr) throw insErr;

      toast({ title: 'Story shared 🎉' });
      navigate('/');
    } catch (err: any) {
      console.error('Share story error', err);
      toast({ title: 'Failed to share story', description: err?.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const hasMedia = !!mediaPreview;
  const isText = mediaType === 'text' && !hasMedia;

  // --- Full-screen overlays for heavy tools ---
  if (activeTool === 'stickers') {
    return <StoryStickerPicker onSelect={addSticker} onClose={() => setActiveTool(null)} />;
  }
  if (activeTool === 'draw') {
    return (
      <StoryDrawing
        canvasWidth={1080}
        canvasHeight={1920}
        onSave={(url) => { setDrawingUrl(url); setActiveTool(null); }}
        onClose={() => setActiveTool(null)}
      />
    );
  }
  if (activeTool === 'crop' && mediaPreview && mediaType === 'image') {
    return <StoryCropTool imageUrl={mediaPreview} onSave={onCropSave} onClose={() => setActiveTool(null)} />;
  }
  if (activeTool === 'audience') {
    return <StoryAudienceSelector selected={audience} onSelect={setAudience} onClose={() => setActiveTool(null)} />;
  }
  if (activeTool === 'textEdit' && editingTextId) {
    const o = textOverlays.find(t => t.id === editingTextId);
    if (o) {
      return (
        <StoryTextOverlay
          overlay={o}
          onUpdate={(u) => setTextOverlays(prev => prev.map(t => t.id === u.id ? u : t))}
          onDelete={(id) => {
            setTextOverlays(prev => prev.filter(t => t.id !== id));
            setEditingTextId(null);
            setActiveTool(null);
          }}
          isEditing
          onEditComplete={() => { setEditingTextId(null); setActiveTool(null); }}
        />
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col text-white select-none">
      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={onFile} className="hidden" />

      {/* Top bar (over canvas) */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 pt-3 pb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          {hasMedia && (
            <button
              onClick={() => setActiveTool('audience')}
              className="h-10 px-3 rounded-full bg-black/40 backdrop-blur-md flex items-center gap-1.5 text-xs font-medium active:scale-95 transition-transform"
            >
              <Users className="h-4 w-4" />
              {audience === 'public' ? 'Everyone' : audience === 'followers' ? 'Followers' : audience === 'close-friends' ? 'Close' : 'Only me'}
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex-1 relative overflow-hidden"
      >
        {hasMedia ? (
          mediaType === 'video' ? (
            <video
              src={mediaPreview!}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: filterCss }}
              autoPlay loop muted playsInline
            />
          ) : (
            <img
              src={mediaPreview!}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: filterCss }}
              draggable={false}
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8" style={{ background: textBg.bg }}>
            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="Type your story..."
              maxLength={250}
              className="w-full max-w-md bg-transparent text-white text-3xl font-bold text-center resize-none focus:outline-none placeholder:text-white/50"
              style={{ caretColor: 'white', minHeight: '50%' }}
            />
          </div>
        )}

        {/* Vignette */}
        {hasMedia && adjustments.vignette > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${adjustments.vignette / 100}) 100%)` }}
          />
        )}

        {/* Drawing overlay */}
        {drawingUrl && (
          <img src={drawingUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        )}

        {/* Text overlays - draggable */}
        {textOverlays.map((o) => (
          <div
            key={o.id}
            onPointerDown={beginDrag(o.id, 'text')}
            onDoubleClick={() => { setEditingTextId(o.id); setActiveTool('textEdit'); }}
            className="absolute touch-none cursor-move"
            style={{
              left: `${o.x}%`, top: `${o.y}%`,
              transform: 'translate(-50%, -50%)',
              color: o.color,
              fontFamily: o.fontFamily,
              fontSize: `${o.fontSize}px`,
              textAlign: o.align,
              textShadow: '0 2px 6px rgba(0,0,0,0.45)',
              maxWidth: '85%', wordBreak: 'break-word',
              fontWeight: 700, lineHeight: 1.15,
            }}
          >
            {o.text}
            <button
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); setTextOverlays(prev => prev.filter(t => t.id !== o.id)); }}
              className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-black/70 flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Stickers - draggable */}
        {stickers.map((s) => (
          <div
            key={s.id}
            onPointerDown={beginDrag(s.id, 'sticker')}
            className="absolute touch-none cursor-move"
            style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="pointer-events-none">
              {/* Reuse StickerDisplay visual but disable its own positioning */}
              <div className="relative">
                {s.type === 'emoji' && <span className="text-5xl">{s.data.emoji}</span>}
                {s.type !== 'emoji' && (
                  <div className="bg-white/90 text-black rounded-xl px-3 py-2 text-sm font-medium">
                    {s.type === 'mention' && `@${s.data.username}`}
                    {s.type === 'hashtag' && `#${s.data.tag}`}
                    {s.type === 'location' && s.data.location}
                    {s.type === 'question' && s.data.question}
                    {s.type === 'poll' && s.data.question}
                    {s.type === 'countdown' && s.data.title}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); setStickers(prev => prev.filter(x => x.id !== s.id)); }}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/70 flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Right-side tool rail (Instagram-style) */}
        {hasMedia && (
          <div className="absolute right-2 top-20 flex flex-col gap-2 z-10">
            <ToolBtn icon={<Type className="h-5 w-5" />} onClick={addText} />
            <ToolBtn icon={<Paintbrush className="h-5 w-5" />} onClick={() => setActiveTool('draw')} />
            <ToolBtn icon={<Smile className="h-5 w-5" />} onClick={() => setActiveTool('stickers')} />
            <ToolBtn icon={<Sparkles className="h-5 w-5" />} onClick={() => setActiveTool('filters')} active={activeTool === 'filters'} />
            <ToolBtn icon={<SlidersHorizontal className="h-5 w-5" />} onClick={() => setActiveTool('adjust')} active={activeTool === 'adjust'} />
            {mediaType === 'image' && (
              <ToolBtn icon={<Crop className="h-5 w-5" />} onClick={() => setActiveTool('crop')} />
            )}
          </div>
        )}

        {/* Text-only background picker */}
        {isText && (
          <div className="absolute bottom-24 left-0 right-0 px-4 z-10">
            <div className="flex gap-2 justify-center overflow-x-auto scrollbar-hide pb-1">
              {textBackgrounds.map(b => (
                <button
                  key={b.id}
                  onClick={() => setTextBg(b)}
                  className={cn(
                    'h-10 w-10 rounded-full border-2 flex-shrink-0 active:scale-95 transition-transform',
                    textBg.id === b.id ? 'border-white scale-110' : 'border-white/30'
                  )}
                  style={{ background: b.bg }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter strip bottom sheet */}
      {hasMedia && activeTool === 'filters' && (
        <BottomSheet onClose={() => setActiveTool(null)} title="Filters">
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {storyFilters.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-transform"
              >
                <div
                  className={cn(
                    'h-16 w-12 rounded-lg overflow-hidden border-2 bg-black/40',
                    selectedFilter === f.id ? 'border-primary' : 'border-transparent'
                  )}
                >
                  {mediaType === 'image' ? (
                    <img src={mediaPreview!} alt="" className="w-full h-full object-cover" style={{ filter: f.css }} draggable={false} />
                  ) : (
                    <video src={mediaPreview!} className="w-full h-full object-cover" style={{ filter: f.css }} muted playsInline />
                  )}
                </div>
                <span className={cn('text-[10px]', selectedFilter === f.id ? 'text-primary font-semibold' : 'text-white/70')}>
                  {f.name}
                </span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Adjust bottom sheet */}
      {hasMedia && activeTool === 'adjust' && (
        <div className="absolute left-0 right-0 bottom-0 z-30 fb-sheet-in">
          <StoryAdjustments values={adjustments} onChange={setAdjustments} onClose={() => setActiveTool(null)} />
        </div>
      )}

      {/* Bottom dock */}
      <div
        className="relative z-20 px-3 pb-3 pt-2 bg-gradient-to-t from-black/70 to-transparent"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
      >
        {!hasMedia ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMediaType('text'); }}
              className={cn(
                'flex-1 h-11 rounded-full flex items-center justify-center gap-2 text-sm font-medium active:scale-[0.98] transition-transform',
                isText ? 'bg-white text-black' : 'bg-white/10 text-white/80'
              )}
            >
              <Type className="h-4 w-4" /> Text
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-11 rounded-full bg-white/10 text-white/90 flex items-center justify-center gap-2 text-sm font-medium active:scale-[0.98] transition-transform"
            >
              <ImageIcon className="h-4 w-4" /> Gallery
            </button>
            <button
              onClick={handleShare}
              disabled={uploading || (isText ? !storyText.trim() : true)}
              className="h-11 px-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Share</>}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => { setMediaFile(null); setMediaPreview(null); setMediaType('text'); setSelectedFilter('none'); setAdjustments(defaultAdjustments); setTextOverlays([]); setStickers([]); setDrawingUrl(null); }}
              className="h-11 px-4 rounded-full bg-white/10 text-white text-sm font-medium active:scale-[0.98] transition-transform"
            >
              Replace
            </button>
            <button
              onClick={handleShare}
              disabled={uploading}
              className="flex-1 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Share story</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ToolBtn = ({ icon, onClick, active }: { icon: React.ReactNode; onClick: () => void; active?: boolean }) => (
  <button
    onClick={onClick}
    className={cn(
      'h-11 w-11 rounded-full backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform',
      active ? 'bg-primary text-primary-foreground' : 'bg-black/40 text-white'
    )}
  >
    {icon}
  </button>
);

const BottomSheet = ({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) => (
  <div className="absolute left-0 right-0 bottom-0 z-30 bg-black/85 backdrop-blur-xl rounded-t-2xl pt-3 pb-4 fb-sheet-in">
    <div className="flex items-center justify-between px-4 pb-3">
      <span className="text-xs font-semibold tracking-wider text-white/70 uppercase">{title}</span>
      <button onClick={onClose} className="text-primary text-xs font-semibold">Done</button>
    </div>
    {children}
  </div>
);

export default CreateStoryPage;