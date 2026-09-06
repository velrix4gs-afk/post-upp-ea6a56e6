import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Image, 
  Video, 
  Smile, 
  MapPin, 
  Users,
  X,
  Save,
  Clock,
  Heart
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { useDrafts } from "@/hooks/useDrafts";
import { useHashtags } from "@/hooks/useHashtags";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { showCleanError } from "@/lib/errorHandler";
import DraftsDialog from "./DraftsDialog";
import { UserTagSelector } from "./UserTagSelector";
import { ReorderableThumbs } from "@/components/composer/ReorderableThumbs";
import { MentionTextarea } from "@/components/composer/MentionTextarea";
import { useGhostDraft } from "@/hooks/useGhostDraft";
import { postContentSchema } from "@/lib/validationSchemas";

const FEELINGS = [
  { emoji: '😊', label: 'happy' },
  { emoji: '😍', label: 'loved' },
  { emoji: '😎', label: 'cool' },
  { emoji: '😢', label: 'sad' },
  { emoji: '😤', label: 'frustrated' },
  { emoji: '🤔', label: 'thoughtful' },
  { emoji: '🎉', label: 'excited' },
  { emoji: '😴', label: 'tired' },
  { emoji: '🤗', label: 'grateful' },
  { emoji: '💪', label: 'motivated' },
];

const CreatePost = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { createPost } = usePosts();
  const { saveDraft } = useDrafts();
  const { processHashtags } = useHashtags();
  const [postContent, setPostContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [createdPostId, setCreatedPostId] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [location, setLocation] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
  const [feeling, setFeeling] = useState<string>('');
  const [showFeelings, setShowFeelings] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const {
    restoredText,
    showRestoredNotice,
    saveDraft: saveGhostDraft,
    clearDraft: clearGhostDraft,
    dismissNotice
  } = useGhostDraft('create-post');

  useEffect(() => {
    if (restoredText && !postContent) {
      setPostContent(restoredText);
      setIsExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredText]);

  useEffect(() => {
    saveGhostDraft(postContent);
  }, [postContent, saveGhostDraft]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    addMediaFiles(Array.from(event.target.files || []));
  };

  const addMediaFiles = (files: File[]) => {
    if (files.length === 0) return;

    // Validate max 10 images
    if (selectedImages.length + files.length > 10) {
      showCleanError({ code: 'POST_001', message: 'Maximum 10 images per post' }, toast);
      return;
    }

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        showCleanError({ code: 'POST_002', message: `${file.name} is not an image or video` }, toast);
        return false;
      }
      // Allow 100MB for videos, 10MB for images
      const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        showCleanError({ 
          code: 'POST_003', 
          message: `${file.name} exceeds ${file.type.startsWith('video/') ? '100MB' : '10MB'} limit` 
        }, toast);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setSelectedImages(prev => [...prev, ...validFiles]);
    
    // Generate previews
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

  const uploadPostMedia = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    setUploadProgress(0);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}-${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, file);

        if (uploadError) {
          console.error('[POST_004] Upload error:', uploadError);
          showCleanError({ code: 'POST_004', message: `Failed to upload ${file.name}` }, toast);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      
      return uploadedUrls;
    } catch (error: any) {
      showCleanError(error, toast, 'Upload Failed');
      return [];
    }
  };

  const handlePost = async () => {
    if (!postContent.trim() && selectedImages.length === 0) {
      showCleanError({ code: 'POST_005', message: 'Add content or media to post' }, toast);
      return;
    }

    // Validate content length
    if (postContent.trim()) {
      const validation = postContentSchema.safeParse(postContent);
      if (!validation.success) {
        showCleanError({ code: 'POST_006', message: validation.error.issues[0].message }, toast);
        return;
      }
    }

    setIsPosting(true);
    try {
      let mediaUrls: string[] = [];
      if (selectedImages.length > 0) {
        mediaUrls = await uploadPostMedia(selectedImages);
        if (mediaUrls.length === 0 && selectedImages.length > 0) {
          setIsPosting(false);
          return;
        }
      }

      let contentWithFeeling = postContent.trim();
      if (feeling) {
        const feelingData = FEELINGS.find(f => f.label === feeling);
        contentWithFeeling = `${feelingData?.emoji} feeling ${feeling}\n\n${contentWithFeeling}`;
      }

      const postData: any = {
        privacy: 'public'
      };
      
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

      if (taggedUsers.length > 0) {
        postData.tagged_users = taggedUsers;
      }

      if (scheduledDate) {
        postData.scheduled_for = scheduledDate.toISOString();
      }

      const newPostId = await createPost(postData);
      setCreatedPostId(newPostId);

      // Process hashtags
      if (contentWithFeeling) {
        await processHashtags(newPostId, contentWithFeeling);
      }

      toast({
        title: '✅ Success!',
        description: scheduledDate ? 'Post scheduled successfully' : 'Post created successfully'
      });

      // Reset form
      setPostContent('');
      setSelectedImages([]);
      setPreviewImages([]);
      setLocation('');
      setTaggedUsers([]);
      setFeeling('');
      setScheduledDate(undefined);
      setUploadProgress(0);
      setIsExpanded(false);
      clearGhostDraft();
    } catch (error: any) {
      showCleanError(error, toast, 'Failed to Create Post');
    } finally {
      setIsPosting(false);
      setUploadProgress(0);
    }
  };

  const handleSaveDraft = async () => {
    if (!postContent.trim() && selectedImages.length === 0) return;
    
    let mediaUrls: string[] = [];
    if (selectedImages.length > 0) {
      mediaUrls = await uploadPostMedia(selectedImages);
    }

    await saveDraft({
      content: postContent.trim(),
      media_url: mediaUrls[0] || null,
      media_type: selectedImages[0]?.type.startsWith('image/') ? 'image' : 'video',
      scheduled_for: scheduledDate?.toISOString()
    });

    // Reset form
    setPostContent("");
    setSelectedImages([]);
    setPreviewImages([]);
    setLocation('');
    setTaggedUsers([]);
    setIsExpanded(false);
    setScheduledDate(undefined);
    clearGhostDraft();
  };

  const handleLoadDraft = (draft: any) => {
    setPostContent(draft.content || '');
    if (draft.media_url) {
      setPreviewImages([draft.media_url]);
    }
    if (draft.scheduled_for) {
      setScheduledDate(new Date(draft.scheduled_for));
    }
    setIsExpanded(true);
  };

  return (
    <Card className="bg-gradient-card border-0 shadow-sm">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-4">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-gradient-primary text-white text-sm">
              {profile?.display_name?.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <MentionTextarea
              placeholder={`What's on your mind, ${profile?.display_name?.split(' ')[0] || 'there'}?`}
              value={postContent}
              onValueChange={setPostContent}
              onFocus={() => setIsExpanded(true)}
              className="border-0 bg-muted/50 resize-none focus-visible:ring-primary min-h-[60px] max-h-[40vh] overflow-y-auto"
              rows={isExpanded ? 4 : 2}
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

        {/* Images Preview */}
        {previewImages.length > 0 && (
          <div className="mb-4">
            <ReorderableThumbs items={previewImages} onReorder={reorderImages} onRemove={removeImage} />
            {previewImages.length > 1 && (
              <p className="mt-1 text-[11px] text-muted-foreground">Hold and drag a photo to change its order</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2 flex-wrap">
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-3"
                onClick={() => setShowGallerySheet(true)}
              >
                <Image className="h-4 w-4 mr-2 text-success" />
                <span className="text-xs">Photo/Video {selectedImages.length > 0 && `(${selectedImages.length})`}</span>
              </Button>
            </div>

            <Popover open={showFeelings} onOpenChange={setShowFeelings}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-3">
                  <Smile className="h-4 w-4 mr-2 text-warning" />
                  <span className="text-xs">{feeling ? `feeling ${feeling}` : 'Feeling'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid grid-cols-5 gap-2">
                  {FEELINGS.map((f) => (
                    <Button
                      key={f.label}
                      variant={feeling === f.label ? "secondary" : "ghost"}
                      className="h-12 flex flex-col items-center justify-center"
                      onClick={() => {
                        setFeeling(feeling === f.label ? '' : f.label);
                        setShowFeelings(false);
                      }}
                    >
                      <span className="text-2xl">{f.emoji}</span>
                      <span className="text-[10px] mt-1">{f.label}</span>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {isExpanded && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 px-3">
                      <MapPin className="h-4 w-4 mr-2 text-primary" />
                      <span className="text-xs">{location || 'Location'}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <Input
                      placeholder="Add location..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 px-3">
                      <Users className="h-4 w-4 mr-2 text-accent" />
                      <span className="text-xs">Tag {taggedUsers.length > 0 && `(${taggedUsers.length})`}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <UserTagSelector
                      selectedUsers={taggedUsers}
                      onUsersChange={setTaggedUsers}
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 px-3">
                      <Clock className="h-4 w-4 mr-2 text-primary" />
                      <span className="text-xs">Schedule</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>

          <div className="flex gap-2">
            {isExpanded && (
              <>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                <DraftsDialog onSelectDraft={handleLoadDraft} />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={!postContent.trim() && selectedImages.length === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
              </>
            )}
            <Button 
              size="sm" 
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              disabled={(!postContent.trim() && selectedImages.length === 0) || isPosting}
              onClick={handlePost}
            >
              {isPosting ? 'Posting...' : scheduledDate ? 'Schedule' : 'Post'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CreatePost;