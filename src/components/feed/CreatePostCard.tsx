import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image, Video, Smile, MapPin, Users, X, Save, Clock, Globe, Lock, UserCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePosts } from "@/hooks/usePosts";
import { useDrafts } from "@/hooks/useDrafts";
import { useHashtags } from "@/hooks/useHashtags";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { showCleanError } from "@/lib/errorHandler";
import DraftsDialog from "../DraftsDialog";
import { UserTagSelector } from "../UserTagSelector";
import { ReorderableThumbs } from "@/components/composer/ReorderableThumbs";
import { MentionTextarea } from "@/components/composer/MentionTextarea";
import { useGhostDraft } from "@/hooks/useGhostDraft";
import { postContentSchema } from "@/lib/validationSchemas";
import { cn } from "@/lib/utils";
const FEELINGS = [{
  emoji: '😊',
  label: 'happy'
}, {
  emoji: '😍',
  label: 'loved'
}, {
  emoji: '😎',
  label: 'cool'
}, {
  emoji: '😢',
  label: 'sad'
}, {
  emoji: '😤',
  label: 'frustrated'
}, {
  emoji: '🤔',
  label: 'thoughtful'
}, {
  emoji: '🎉',
  label: 'excited'
}, {
  emoji: '😴',
  label: 'tired'
}, {
  emoji: '🤗',
  label: 'grateful'
}, {
  emoji: '💪',
  label: 'motivated'
}];
const MAX_CHARS = 5000;
const CreatePostCard = () => {
  const {
    user
  } = useAuth();
  const {
    profile
  } = useProfile();
  const {
    createPost
  } = usePosts();
  const {
    saveDraft
  } = useDrafts();
  const {
    processHashtags
  } = useHashtags();
  const [postContent, setPostContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [location, setLocation] = useState('');
  const [taggedUsers, setTaggedUsers] = useState<string[]>([]);
  const [feeling, setFeeling] = useState<string>('');
  const [showFeelings, setShowFeelings] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  const {
    restoredText,
    showRestoredNotice,
    saveDraft: saveGhostDraft,
    clearDraft: clearGhostDraft,
    dismissNotice
  } = useGhostDraft('feed-composer');

  // Ghost drafting: bring back whatever the user typed before they navigated away.
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

  const charCount = postContent.length;
  const charPercentage = charCount / MAX_CHARS * 100;
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (selectedImages.length + files.length > 10) {
      showCleanError({
        code: 'POST_001',
        message: 'Maximum 10 images per post'
      }, toast);
      return;
    }
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        showCleanError({
          code: 'POST_002',
          message: `${file.name} is not an image or video`
        }, toast);
        return false;
      }
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
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
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
        const {
          error: uploadError
        } = await supabase.storage.from('posts').upload(fileName, file);
        if (uploadError) {
          console.error('[POST_004] Upload error:', uploadError);
          showCleanError({
            code: 'POST_004',
            message: `Failed to upload ${file.name}`
          }, toast);
          throw uploadError;
        }
        const {
          data: {
            publicUrl
          }
        } = supabase.storage.from('posts').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
        setUploadProgress(Math.round((i + 1) / files.length * 100));
      }
      return uploadedUrls;
    } catch (error: any) {
      showCleanError(error, toast, 'Upload Failed');
      return [];
    }
  };
  const handlePost = async () => {
    haptic('heavy');
    if (!postContent.trim() && selectedImages.length === 0) {
      showCleanError({
        code: 'POST_005',
        message: 'Add content or media to post'
      }, toast);
      return;
    }
    if (postContent.trim()) {
      const validation = postContentSchema.safeParse(postContent);
      if (!validation.success) {
        showCleanError({
          code: 'POST_006',
          message: validation.error.issues[0].message
        }, toast);
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
        privacy
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
      if (contentWithFeeling) {
        await processHashtags(newPostId, contentWithFeeling);
      }
      toast({
        title: 'Posted!',
        description: scheduledDate ? 'Post scheduled successfully' : 'Your post is now live'
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
  const getPrivacyIcon = () => {
    switch (privacy) {
      case 'public':
        return <Globe className="h-4 w-4" />;
      case 'friends':
        return <UserCheck className="h-4 w-4" />;
      case 'private':
        return <Lock className="h-4 w-4" />;
    }
  };
  return <Card className="bg-card border-border shadow-sm w-full max-w-full overflow-hidden rounded-md border-0">
      <div className="min-w-0 overflow-x-hidden\n">
        {/* Header with Avatar */}
        <div className="flex items-center space-x-3 mb-4 pt-[10px] pr-[9px] pl-[5px]">
          <Avatar className="h-10 w-10 ring-2 ring-border flex-shrink-0">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {profile?.display_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 max-w-full overflow-hidden">
            <MentionTextarea placeholder={`What's on your mind, ${profile?.display_name?.split(' ')[0] || 'there'}?`} value={postContent} onValueChange={value => {
            if (value.length <= MAX_CHARS) {
              setPostContent(value);
            }
          }} onFocus={() => setIsExpanded(true)} className="border-0 bg-muted/50 resize-none focus-visible:ring-primary min-h-[60px] max-h-[40vh] overflow-y-auto pr-[5px]" />

            {showRestoredNotice && <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Picked up where you left off.</span>
                <button type="button" onClick={() => {
              setPostContent('');
              clearGhostDraft();
            }} className="text-xs font-medium text-primary hover:underline">
                  Discard
                </button>
                <button type="button" onClick={dismissNotice} className="text-xs text-muted-foreground hover:underline">
                  Dismiss
                </button>
              </div>}
            
            {/* Character counter */}
            {isExpanded && postContent.length > 0 && <div className="flex items-center justify-end mt-2 gap-2">
                <div className="relative h-5 w-5">
                  <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" fill="none" stroke="hsl(var(--muted))" strokeWidth="2" />
                    <circle cx="10" cy="10" r="8" fill="none" stroke={charPercentage > 90 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} strokeWidth="2" strokeDasharray={`${charPercentage * 0.5} 50`} strokeLinecap="round" />
                  </svg>
                </div>
                <span className={cn("text-xs", charPercentage > 90 ? "text-destructive" : "text-muted-foreground")}>
                  {charCount}/{MAX_CHARS}
                </span>
              </div>}
          </div>
        </div>

        {/* Image Previews - BELOW text area as thumbnails */}
        {previewImages.length > 0 && <div className="px-2">
            <ReorderableThumbs items={previewImages} onReorder={reorderImages} onRemove={removeImage} />
            {previewImages.length > 1 && <p className="mt-1 text-[11px] text-muted-foreground">
                Hold and drag a photo to change its order
              </p>}
          </div>}

        {/* Upload Progress */}
        {uploadProgress > 0 && uploadProgress < 100 && <div className="mt-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{
            width: `${uploadProgress}%`
          }} />
            </div>
          </div>}

        {/* Divider */}
        <div className="border-t mt-4 pt-3 border-black/0">
          {/* Action Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-[7px] pr-[5px] pl-[3px]">
            <div className="flex items-center gap-1 flex-wrap">
              {/* Photo/Video */}
              <div className="relative">
                <input type="file" accept="image/*,video/*" onChange={handleImageUpload} className="hidden" id="image-upload" multiple />
                <label htmlFor="image-upload">
                  <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 cursor-pointer rounded-lg hover:bg-success/10" asChild>
                    <span>
                      <Image className="h-5 w-5 text-success" />
                      <span className="text-sm hidden sm:inline">Photo/Video</span>
                      {selectedImages.length > 0 && <span className="text-xs bg-success/20 text-success px-1.5 rounded-full">
                          {selectedImages.length}
                        </span>}
                    </span>
                  </Button>
                </label>
              </div>

              {/* Feeling */}
              <Popover open={showFeelings} onOpenChange={setShowFeelings}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 rounded-lg hover:bg-warning/10">
                    <Smile className="h-5 w-5 text-warning" />
                    <span className="text-sm hidden sm:inline">
                      {feeling ? `${FEELINGS.find(f => f.label === feeling)?.emoji}` : 'Feeling'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3">
                  <div className="grid grid-cols-5 gap-2">
                    {FEELINGS.map(f => <Button key={f.label} variant={feeling === f.label ? "secondary" : "ghost"} className="h-12 flex flex-col items-center justify-center p-1" onClick={() => {
                    setFeeling(feeling === f.label ? '' : f.label);
                    setShowFeelings(false);
                  }}>
                        <span className="text-xl">{f.emoji}</span>
                        <span className="text-[9px] mt-0.5 truncate">{f.label}</span>
                      </Button>)}
                  </div>
                </PopoverContent>
              </Popover>

              {isExpanded && <>
                  {/* Tag */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 rounded-lg hover:bg-accent/10">
                        <Users className="h-5 w-5 text-accent" />
                        <span className="text-sm hidden sm:inline">Tag</span>
                        {taggedUsers.length > 0 && <span className="text-xs bg-accent/20 text-accent px-1.5 rounded-full">
                            {taggedUsers.length}
                          </span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <UserTagSelector selectedUsers={taggedUsers} onUsersChange={setTaggedUsers} />
                    </PopoverContent>
                  </Popover>

                  {/* Schedule */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 rounded-lg hover:bg-primary/10">
                        <Clock className="h-5 w-5 text-primary" />
                        <span className="text-sm hidden sm:inline">Schedule</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} disabled={date => date < new Date()} />
                    </PopoverContent>
                  </Popover>
                </>}
            </div>

            <div className="flex items-center gap-2">
              {isExpanded && <>
                  {/* Privacy Selector */}
                  <Select value={privacy} onValueChange={(v: any) => setPrivacy(v)}>
                    <SelectTrigger className="w-auto h-9 gap-2 border-0 bg-muted/50">
                      {getPrivacyIcon()}
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">
                        <div className="flex items-center gap-2">
                          <span>Public</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="friends">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          <span>Friends</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="private">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          <span>Only Me</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <DraftsDialog onSelectDraft={handleLoadDraft} />
                  
                  <Button variant="outline" size="sm" className="h-9" onClick={handleSaveDraft} disabled={!postContent.trim() && selectedImages.length === 0}>
                    <Save className="h-4 w-4 mr-2" />
                    Draft
                  </Button>
                </>}
              
              <Button size="sm" className="h-9 px-6 rounded-full bg-primary hover:bg-primary-hover font-semibold" disabled={!postContent.trim() && selectedImages.length === 0 || isPosting} onClick={handlePost}>
                {isPosting ? 'Posting...' : scheduledDate ? 'Schedule' : 'Post'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>;
};
export default CreatePostCard;