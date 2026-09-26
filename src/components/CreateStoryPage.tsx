import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X, Type, Smile, Image as ImageIcon, Send, Loader2,
  Paintbrush, Crop, SlidersHorizontal, Sparkles, Users,
  Video, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStories } from '@/hooks/useStories';
import { toast } from '@/hooks/use-toast';
import { StoryFilterPicker, storyFilters } from './story/StoryFilters';
import { StoryDrawing } from './story/StoryDrawing';
import { StoryTextOverlay } from './story/StoryTextOverlay';
import { StoryStickerPicker, StickerDisplay, Sticker } from './story/StoryStickers';
import { StoryAudienceSelector, StoryAudience } from './story/StoryAudienceSelector';
import { StoryCropTool } from './story/StoryCropTool';
import { StoryAdjustments, AdjustmentValues, defaultAdjustments, adjustmentsToCss } from './story/StoryAdjustments';

const textStyles = [
  { id: 'default', name: 'Classic', bg: 'bg-gradient-to-br from-primary to-accent' },
  { id: 'warm', name: 'Warm', bg: 'bg-gradient-to-br from-orange-400 to-red-500' },
  { id: 'cool', name: 'Cool', bg: 'bg-gradient-to-br from-blue-400 to-cyan-500' },
  { id: 'dark', name: 'Dark', bg: 'bg-gradient-to-br from-gray-800 to-black' },
  { id: 'neon', name: 'Neon', bg: 'bg-gradient-to-br from-green-400 to-purple-600' },
  { id: 'sunset', name: 'Sunset', bg: 'bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500' },
];

type EditorMode = 'preview' | 'filters' | 'adjust' | 'crop' | 'text' | 'draw' | 'stickers' | 'audience';

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

const CreateStoryPage = () => {
  const navigate = useNavigate();
  const { createStory } = useStories();

  // Media state
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [text, setText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(textStyles[0]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Editor state
  const [editorMode, setEditorMode] = useState<EditorMode>('preview');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [adjustments, setAdjustments] = useState<AdjustmentValues>(defaultAdjustments);
  const [textOverlays, setTextOverlays] = useState<TextOverlayItem[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [audience, setAudience] = useState<StoryAudience>('public');
  const [drawingDataUrl, setDrawingDataUrl] = useState<string | null>(null);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'File too large (max 50MB)', variant: 'destructive' });
      return;
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
    setMode('media');
    setEditorMode('preview');
  };

  const getFilterCss = () => {
    const filter = storyFilters.find((f) => f.id === selectedFilter);
    const filterCss = filter?.css || 'none';
    const adjCss = adjustmentsToCss(adjustments);
    if (filterCss === 'none' && adjCss === 'none') return 'none';
    if (filterCss === 'none') return adjCss;
    if (adjCss === 'none') return filterCss;
    return `${filterCss} ${adjCss}`;
  };

  const handleAddText = () => {
    const newOverlay: TextOverlayItem = {
      id: Date.now().toString(),
      text: 'Tap to edit',
      x: 50,
      y: 50,
      color: '#FFFFFF',
      fontSize: 28,
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      align: 'center',
    };
    setTextOverlays((prev) => [...prev, newOverlay]);
    setEditingTextId(newOverlay.id);
    setEditorMode('text');
  };

  const handleAddSticker = (stickerData: Omit<Sticker, 'id' | 'x' | 'y'>) => {
    const newSticker: Sticker = {
      ...stickerData,
      id: Date.now().toString(),
      x: 50,
      y: 30 + Math.random() * 40,
    };
    setStickers((prev) => [...prev, newSticker]);
    setEditorMode('preview');
  };

  const handleCropSave = (croppedUrl: string) => {
    setMediaPreview(croppedUrl);
    // Convert data URL to File for upload
    fetch(croppedUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], 'cropped-story.jpg', { type: 'image/jpeg' });
        setMediaFile(file);
      });
    setEditorMode('preview');
  };

  const handleDrawingSave = (dataUrl: string) => {
    setDrawingDataUrl(dataUrl);
    setEditorMode('preview');
  };

  const handlePost = async () => {
    if (mode === 'text' && !text.trim()) {
      toast({ title: 'Add some text first', variant: 'destructive' });
      return;
    }
    if (mode === 'media' && !mediaFile) {
      toast({ title: 'Select media first', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const success = mode === 'media' && mediaFile
        ? await createStory(undefined, mediaFile, audience)
        : await createStory(text, undefined, audience);
      if (success) navigate('/');
    } catch (error) {
      console.error('Story creation error:', error);
      toast({ title: 'Failed to post story', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // Toolbar buttons for media mode
  const toolbarItems = [
    { id: 'filters', icon: Sparkles, label: 'Filters' },
    { id: 'adjust', icon: SlidersHorizontal, label: 'Adjust' },
    { id: 'crop', icon: Crop, label: 'Crop' },
    { id: 'text', icon: Type, label: 'Text', action: handleAddText },
    { id: 'draw', icon: Paintbrush, label: 'Draw' },
    { id: 'stickers', icon: Smile, label: 'Stickers' },
  ];

  const renderMediaPreview = () => {
    const filterStyle = { filter: getFilterCss() };

    return (
      <div className="relative w-full h-full">
        {mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={mediaPreview!}
            className="w-full h-full object-cover"
            style={filterStyle}
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={mediaPreview!}
            alt="Story"
            className="w-full h-full object-cover"
            style={filterStyle}
          />
        )}

        {/* Drawing overlay */}
        {drawingDataUrl && (
          <img
            src={drawingDataUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        {/* Text overlays */}
        {textOverlays.map((overlay) => (
          <StoryTextOverlay
            key={overlay.id}
            overlay={overlay}
            onUpdate={(updated) =>
              setTextOverlays((prev) =>
                prev.map((o) => (o.id === updated.id ? updated : o))
              )
            }
            onDelete={(id) => {
              setTextOverlays((prev) => prev.filter((o) => o.id !== id));
              setEditingTextId(null);
              setEditorMode('preview');
            }}
            isEditing={editingTextId === overlay.id}
            onEditComplete={() => {
              setEditingTextId(null);
              setEditorMode('preview');
            }}
          />
        ))}

        {/* Stickers */}
        {stickers.map((sticker) => (
          <StickerDisplay
            key={sticker.id}
            sticker={sticker}
            onDelete={(id) => setStickers((prev) => prev.filter((s) => s.id !== id))}
          />
        ))}

        {/* Vignette overlay */}
        {adjustments.vignette > 0 && (
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${adjustments.vignette / 100}) 100%)`,
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Top header */}
      <div className="flex items-center justify-between px-4 py-3 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-white hover:bg-white/10"
        >
          <X className="h-6 w-6" />
        </Button>

        <div className="flex items-center gap-2">
          {mode === 'media' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditorMode('audience')}
              className="text-white/80 hover:bg-white/10 text-xs gap-1"
            >
              <Users className="h-4 w-4" />
              {audience === 'public' ? 'Everyone' : audience === 'followers' ? 'Followers' : audience === 'close-friends' ? 'Close Friends' : 'Only Me'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            onClick={handlePost}
            disabled={uploading || (mode === 'text' && !text.trim()) || (mode === 'media' && !mediaFile)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Share'}
          </Button>
        </div>
      </div>

      {/* Main preview area */}
      <div className="flex-1 relative mx-2 mb-2 rounded-2xl overflow-hidden">
        {mode === 'text' ? (
          <div className={`w-full h-full ${selectedStyle.bg} flex items-center justify-center p-8`}>
            <p className="text-white text-3xl font-bold text-center break-words max-w-full">
              {text || 'Type your story...'}
            </p>
          </div>
        ) : mediaPreview ? (
          renderMediaPreview()
        ) : (
          <div className="w-full h-full bg-muted/10 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-white/50" />
            </div>
            <p className="text-white/50 text-sm">Select a photo or video</p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="pb-6 pt-2 px-2 space-y-3">
        {/* Editor toolbar for media mode */}
        {mode === 'media' && mediaPreview && editorMode === 'preview' && (
          <div className="flex justify-around px-2">
            {toolbarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) {
                    item.action();
                  } else {
                    setEditorMode(item.id as EditorMode);
                  }
                }}
                className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px]">{item.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filters panel */}
        {mode === 'media' && editorMode === 'filters' && (
          <div>
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-white/70 text-xs font-medium">FILTERS</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditorMode('preview')}
                className="text-primary text-xs"
              >
                Done
              </Button>
            </div>
            <StoryFilterPicker
              selectedFilter={selectedFilter}
              onSelect={setSelectedFilter}
              previewUrl={mediaPreview}
            />
          </div>
        )}

        {/* Adjustments panel */}
        {mode === 'media' && editorMode === 'adjust' && (
          <StoryAdjustments
            values={adjustments}
            onChange={setAdjustments}
            onClose={() => setEditorMode('preview')}
          />
        )}

        {/* Text mode controls */}
        {mode === 'text' && (
          <div className="space-y-3 px-2">
            <Input
              placeholder="Type your story..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-lg rounded-xl"
            />
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {textStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style)}
                  className={`flex-shrink-0 w-12 h-12 rounded-xl ${style.bg} transition-transform ${
                    selectedStyle.id === style.id ? 'ring-2 ring-white scale-110' : 'opacity-70'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Mode toggle */}
        {editorMode === 'preview' && (
          <div className="flex gap-2 px-2">
            <Button
              variant={mode === 'text' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('text')}
              className={`flex-1 rounded-xl ${mode !== 'text' ? 'text-white/70 hover:bg-white/10' : ''}`}
            >
              <Type className="h-4 w-4 mr-2" />
              Text
            </Button>
            <Button
              variant={mode === 'media' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 rounded-xl ${mode !== 'media' ? 'text-white/70 hover:bg-white/10' : ''}`}
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              Photo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = 'video/*';
                  fileInputRef.current.click();
                  // Reset accept after click
                  setTimeout(() => {
                    if (fileInputRef.current) fileInputRef.current.accept = 'image/*,video/*';
                  }, 100);
                }
              }}
              className="flex-1 rounded-xl text-white/70 hover:bg-white/10"
            >
              <Video className="h-4 w-4 mr-2" />
              Video
            </Button>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaSelect}
        className="hidden"
      />

      {/* Full-screen overlays */}
      {editorMode === 'crop' && mediaPreview && mediaType === 'image' && (
        <StoryCropTool
          imageUrl={mediaPreview}
          onSave={handleCropSave}
          onClose={() => setEditorMode('preview')}
        />
      )}

      {editorMode === 'draw' && (
        <StoryDrawing
          canvasWidth={1080}
          canvasHeight={1920}
          onSave={handleDrawingSave}
          onClose={() => setEditorMode('preview')}
        />
      )}

      {editorMode === 'stickers' && (
        <StoryStickerPicker
          onSelect={handleAddSticker}
          onClose={() => setEditorMode('preview')}
        />
      )}

      {editorMode === 'audience' && (
        <StoryAudienceSelector
          selected={audience}
          onSelect={setAudience}
          onClose={() => setEditorMode('preview')}
        />
      )}
    </div>
  );
};

export default CreateStoryPage;
