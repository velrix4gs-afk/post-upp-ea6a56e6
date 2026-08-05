import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { 
  Image, 
  MapPin, 
  Smile, 
  X,
  Loader2
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { useHashtags } from "@/hooks/useHashtags";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { showCleanError } from "@/lib/errorHandler";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useThumbReorder } from "@/components/composer/ReorderableThumbs";
import { MentionTextarea } from "@/components/composer/MentionTextarea";
import { useGhostDraft } from "@/hooks/useGhostDraft";
import { cn } from "@/lib/utils";

const FEELINGS = [
  { emoji: '😊', label: 'happy' },
  { emoji: '😍', label: 'loved' },
  { emoji: '😎', label: 'cool' },
  { emoji: '😢', label: 'sad' },
  { emoji: '😤', label: 'frustrated' },
  { emoji: '🤔', label: 'thoughtful' },
  { emoji: '🎉', label: 'excited' },
  { emoji: '😴', label: 'tired' },
];

interface CreatePostSimpleProps {
  onSuccess?: () => void;
}

const CreatePostSimple = ({ onSuccess }: CreatePostSimpleProps) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { createPost } = usePosts();
  const { processHashtags } = useHashtags();
  
  const [postContent, setPostContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [location, setLocation] = useState('');
  const [feeling, setFeeling] = useState<string>('');
  const [showFeelings, setShowFeelings] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    restoredText,
    showRestoredNotice,
    saveDraft: saveGhostDraft,
    clearDraft: clearGhostDraft,
    dismissNotice
  } = useGhostDraft('create-post-simple');

  useEffect(() => {
    if (restoredText && !postContent) setPostContent(restoredText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredText]);

  useEffect(() => {
    saveGhostDraft(postContent);
  }, [postContent, saveGhostDraft]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (selectedImages.length + files.length > 10) {
      showCleanError({ code: 'POST_001', message: 'Maximum 10 images per post' }, toast);
      return;
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        return false;
      }
      const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        showCleanError({ 
          code: 'POST_003', 
          message: `File exceeds ${file.type.startsWith('video/') ? '100MB' : '10MB'} limit` 
        }, toast);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setSelectedImages(prev => [...prev, ...validFiles]);
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImages(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
  };

  const reorderImages = (from: number, to: number) => {
    const move = <T,>(arr: T[]): T[] => {
      const next = [...arr];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    };
    setSelectedImages(prev => move(prev));
    setPreviewImages(prev => move(prev));
  };

  const { getItemProps } = useThumbReorder(reorderImages);

  const uploadPostMedia = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}-${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }
    
    return uploadedUrls;
  };

  const handlePost = async () => {
    if (!postContent.trim() && selectedImages.length === 0) {
      showCleanError({ code: 'POST_005', message: 'Add content or media to post' }, toast);
      return;
    }

    setIsPosting(true);
    try {
      let mediaUrls: string[] = [];
      if (selectedImages.length > 0) {
        mediaUrls = await uploadPostMedia(selectedImages);
      }

      let contentWithFeeling = postContent.trim();
      if (feeling) {
        const feelingData = FEELINGS.find(f => f.label === feeling);
        contentWithFeeling = `${feelingData?.emoji} feeling ${feeling}\n\n${contentWithFeeling}`;
      }

      const postData: any = { privacy: 'public' };
      
      if (contentWithFeeling) {
        postData.content = contentWithFeeling;
      }
      
      if (mediaUrls.length > 0) {
        if (mediaUrls.length === 1) {
          postData.media_url = mediaUrls[0];
          postData.media_type = selectedImages[0].type.startsWith('image/') ? 'image' : 'video';
        } else {
          postData.media_urls = mediaUrls;
          postData.media_type = 'multiple';
        }
      }

      if (location.trim()) {
        postData.location = location.trim();
      }

      const newPostId = await createPost(postData);

      if (contentWithFeeling) {
        await processHashtags(newPostId, contentWithFeeling);
      }

      toast({
        title: '✅ Posted!',
        description: 'Your post is now live'
      });

      // Reset form
      setPostContent('');
      setSelectedImages([]);
      setPreviewImages([]);
      setLocation('');
      setFeeling('');
      clearGhostDraft();

      onSuccess?.();
    } catch (error: any) {
      showCleanError(error, toast, 'Failed to Create Post');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with avatar and textarea */}
      <div className="flex gap-3 p-4">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={profile?.avatar_url} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {profile?.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <MentionTextarea
            placeholder={`What's on your mind?`}
            value={postContent}
            onValueChange={setPostContent}
            className="w-full border-0 bg-transparent resize-none focus-visible:ring-0 text-base placeholder:text-muted-foreground/60 min-h-[100px]"
            autoFocus
          />
          {showRestoredNotice && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Picked up where you left off.</span>
              <button
                type="button"
                onClick={() => { setPostContent(''); clearGhostDraft(); }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Discard
              </button>
              <button type="button" onClick={dismissNotice} className="text-xs text-muted-foreground hover:underline">
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feeling indicator */}
      {feeling && (
        <div className="px-4 pb-2">
          <span className="text-sm text-muted-foreground">
            {FEELINGS.find(f => f.label === feeling)?.emoji} feeling {feeling}
          </span>
        </div>
      )}

      {/* Location indicator */}
      {location && (
        <div className="px-4 pb-2 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{location}</span>
        </div>
      )}

      {/* Image previews */}
      {previewImages.length > 0 && (
        <div className="px-4 pb-4">
          <div className={`grid gap-2 ${
            previewImages.length === 1 ? 'grid-cols-1' :
            previewImages.length === 2 ? 'grid-cols-2' :
            'grid-cols-3'
          }`}>
            {previewImages.map((preview, index) => {
              const { className: dragClass, ...dragProps } = getItemProps(index);
              return (
              <div key={index} {...dragProps} className={cn("relative aspect-square touch-none", dragClass)}>
                {selectedImages[index]?.type.startsWith('video/') ? (
                  <video 
                    src={preview} 
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <img 
                    src={preview} 
                    alt={`Preview ${index + 1}`} 
                    className="w-full h-full object-cover rounded-xl"
                  />
                )}
                <span className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 text-[10px] text-white">
                  {index + 1}
                </span>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 hover:bg-black/70"
                  onClick={() => removeImage(index)}
                >
                  <X className="h-3 w-3 text-white" />
                </Button>
              </div>
            );})}
          </div>
          {previewImages.length > 1 && (
            <p className="mt-2 text-[11px] text-muted-foreground">Hold and drag a photo to change its order</p>
          )}
        </div>
      )}

      {/* Bottom action bar */}
      <div className="mt-auto border-t border-border/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Photo/Video */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleImageUpload}
              className="hidden"
              multiple
            />
            <Button 
              variant="ghost" 
              size="icon"
              className="h-10 w-10 rounded-full text-success hover:bg-success/10"
              onClick={() => fileInputRef.current?.click()}
            >
              <Image className="h-5 w-5" />
            </Button>

            {/* Location */}
            <Popover open={showLocation} onOpenChange={setShowLocation}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-10 w-10 rounded-full text-primary hover:bg-primary/10"
                >
                  <MapPin className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <Input
                  placeholder="Add location..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setShowLocation(false)}
                />
              </PopoverContent>
            </Popover>

            {/* Feeling */}
            <Popover open={showFeelings} onOpenChange={setShowFeelings}>
              <PopoverTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-10 w-10 rounded-full text-warning hover:bg-warning/10"
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="start">
                <div className="grid grid-cols-4 gap-2">
                  {FEELINGS.map((f) => (
                    <Button
                      key={f.label}
                      variant={feeling === f.label ? "secondary" : "ghost"}
                      className="h-14 flex flex-col items-center justify-center"
                      onClick={() => {
                        setFeeling(feeling === f.label ? '' : f.label);
                        setShowFeelings(false);
                      }}
                    >
                      <span className="text-2xl">{f.emoji}</span>
                      <span className="text-[9px] mt-0.5">{f.label}</span>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Post button */}
          <Button 
            onClick={handlePost}
            disabled={(!postContent.trim() && selectedImages.length === 0) || isPosting}
            className="rounded-full px-6 font-semibold"
          >
            {isPosting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              'Post'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreatePostSimple;
