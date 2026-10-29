import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Image as ImageIcon, MapPin, Clock, Save, Globe, Lock, UserCheck,
  Scissors, Sparkles, Plus, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePosts } from '@/hooks/usePosts';
import { useDrafts } from '@/hooks/useDrafts';
import { useHashtags } from '@/hooks/useHashtags';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useGhostDraft } from '@/hooks/useGhostDraft';
import { formatMB } from '@/lib/entitlements';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { showCleanError } from '@/lib/errorHandler';
import { postContentSchema } from '@/lib/validationSchemas';
import { cn } from '@/lib/utils';
import { MentionTextarea } from '@/components/composer/MentionTextarea';
import { ReorderableThumbs } from '@/components/composer/ReorderableThumbs';
import DraftsDialog from '@/components/DraftsDialog';
import { GalleryPickerSheet } from '@/components/showcase/GalleryPickerSheet';
import { VideoEditorDialog } from '@/components/VideoEditorDialog';
import { PhotoEditorDialog } from '@/components/PhotoEditorDialog';
import { normalizeMediaFile } from '@/lib/deviceGallery';

const MAX_CHARS = 5000;

const CreatePostPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const entitlements = useEntitlements();
  const { createPost } = usePosts();
  const { saveDraft } = useDrafts();
  const { processHashtags } = useHashtags();

  const [postContent, setPostContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [previewMedia, setPreviewMedia] = useState<string[]>([]);
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(null);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [showGallerySheet, setShowGallerySheet] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [location, setLocation] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public');

  const previewMediaRef = useRef<string[]>([]);
  const { restoredText, showRestoredNotice, saveDraft: saveGhostDraft, clearDraft: clearGhostDraft, dismissNotice } =
    useGhostDraft('create-post');

  useEffect(() => {
    if (restoredText && !postContent) setPostContent(restoredText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredText]);

  useEffect(() => {
    saveGhostDraft(postContent);
  }, [postContent, saveGhostDraft]);

  useEffect(() => {
    previewMediaRef.current = previewMedia;
  }, [previewMedia]);

  useEffect(
    () => () => {
      previewMediaRef.current.forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    },
    [],
  );

  const clearPreviewUrls = () => {
    previewMedia.forEach((url) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    previewMediaRef.current = [];
  };

  const replaceMedia = (index: number, file: File) => {
    const old = previewMedia[index];
    if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
    setSelectedMedia((prev) => prev.map((f, i) => (i === index ? file : f)));
    setPreviewMedia((prev) => prev.map((u, i) => (i === index ? URL.createObjectURL(file) : u)));
  };

  const addMediaFiles = (files: File[]) => {
    if (files.length === 0) return;
    const validFiles = files.flatMap((file) => {
      const normalized = normalizeMediaFile(file);
      if (!normalized) {
        showCleanError({ code: 'POST_002', message: `${file.name} is not an image or video` }, toast);
        return [];
      }
      const isVideo = normalized.type.startsWith('video/');
      const limitMB = isVideo ? entitlements.videoMB : entitlements.photoMB;
      if (normalized.size > limitMB * 1024 * 1024) {
        showCleanError({
          code: 'POST_003',
          message: `${file.name} exceeds your ${formatMB(limitMB)} ${isVideo ? 'video' : 'photo'} limit${entitlements.plan === 'elite' ? '' : ' — upgrade in Premium for bigger uploads'}`,
        }, toast);
        return [];
      }
      return [normalized];
    });

    const existingKeys = new Set(selectedMedia.map((f) => `${f.name}:${f.size}:${f.lastModified}`));
    const uniqueFiles = validFiles.filter((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    if (uniqueFiles.length === 0) return;

    const availableSlots = Math.max(0, 10 - selectedMedia.length);
    if (uniqueFiles.length > availableSlots) {
      showCleanError({ code: 'POST_001', message: 'Maximum 10 items per post; added the first remaining items' }, toast);
    }
    const accepted = uniqueFiles.slice(0, availableSlots);
    setSelectedMedia((prev) => [...prev, ...accepted]);
    setPreviewMedia((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
  };

  const removeMedia = (index: number) => {
    const preview = previewMedia[index];
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
    setPreviewMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const reorderMedia = (from: number, to: number) => {
    const move = <T,>(arr: T[]): T[] => {
      const next = [...arr];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    };
    setSelectedMedia((prev) => move(prev));
    setPreviewMedia((prev) => move(prev));
  };

  const uploadPostMedia = async (files: File[]): Promise<string[]> => {
    if (!user?.id) throw new Error('You must be logged in to upload post media');
    const uploadedUrls: string[] = [];
    setUploadProgress(0);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('posts').upload(fileName, file, {
        contentType: file.type || undefined,
      });
      if (uploadError) {
        console.error('[POST_004] Upload error:', uploadError);
        throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
      }
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(fileName);
      uploadedUrls.push(publicUrl);
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }
    return uploadedUrls;
  };

  const resetForm = () => {
    setPostContent('');
    setSelectedMedia([]);
    clearPreviewUrls();
    setPreviewMedia([]);
    setLocation('');
    setScheduledDate(undefined);
    setUploadProgress(0);
    clearGhostDraft();
  };

  const handlePost = async () => {
    haptic('heavy');
    if (!postContent.trim() && selectedMedia.length === 0) {
      showCleanError({ code: 'POST_005', message: 'Add content or media to post' }, toast);
      return;
    }
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
      if (selectedMedia.length > 0) {
        mediaUrls = await uploadPostMedia(selectedMedia);
        if (mediaUrls.length === 0) {
          setIsPosting(false);
          return;
        }
      }

      const postData: any = { privacy };
      if (postContent.trim()) postData.content = postContent.trim();

      if (mediaUrls.length > 0) {
        if (mediaUrls.length === 1) {
          postData.media_url = mediaUrls[0];
          postData.media_type = selectedMedia[0].type.startsWith('image/') ? 'image' : 'video';
        } else {
          postData.media_urls = mediaUrls;
          postData.media_type = 'multiple';
        }
      }

      if (location.trim()) postData.location = location.trim();
      if (scheduledDate) postData.scheduled_for = scheduledDate.toISOString();

      const createdPost = await createPost(postData);
      if (!('queued' in createdPost) && postContent.trim()) {
        await processHashtags(createdPost.id, postContent.trim());
      }

      toast({
        title: 'queued' in createdPost ? 'Post queued' : 'Posted!',
        description:
          'queued' in createdPost
            ? "Your post will be published when you're back online"
            : scheduledDate ? 'Post scheduled successfully' : 'Your post is now live',
      });

      resetForm();
      navigate(-1);
    } catch (error: any) {
      showCleanError(error, toast, 'Failed to Create Post');
    } finally {
      setIsPosting(false);
      setUploadProgress(0);
    }
  };

  const handleSaveDraft = async () => {
    if (!postContent.trim() && selectedMedia.length === 0) return;
    let mediaUrls: string[] = [];
    if (selectedMedia.length > 0) mediaUrls = await uploadPostMedia(selectedMedia);
    await saveDraft({
      content: postContent.trim(),
      media_url: mediaUrls[0] || null,
      media_type: selectedMedia[0]?.type.startsWith('image/') ? 'image' : 'video',
      scheduled_for: scheduledDate?.toISOString(),
    });
    resetForm();
    toast({ title: 'Draft saved' });
  };

  const handleLoadDraft = (draft: any) => {
    setPostContent(draft.content || '');
    clearPreviewUrls();
    if (draft.media_url) setPreviewMedia([draft.media_url]);
    if (draft.scheduled_for) setScheduledDate(new Date(draft.scheduled_for));
  };

  const canPost = (postContent.trim().length > 0 || selectedMedia.length > 0) && !isPosting;
  const charCount = postContent.length;

  const getPrivacyIcon = () => {
    switch (privacy) {
      case 'public': return <Globe className="h-4 w-4" />;
      case 'friends': return <UserCheck className="h-4 w-4" />;
      case 'private': return <Lock className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" style={{ height: '100dvh' }}>
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 pb-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => navigate(-1)} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
        <span className="text-base font-semibold">New post</span>
        <Button
          size="sm"
          className="h-9 rounded-full px-5 font-semibold"
          disabled={!canPost}
          onClick={handlePost}
        >
          {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : scheduledDate ? 'Schedule' : 'Post'}
        </Button>
      </div>

      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="h-1 shrink-0 bg-muted">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4">
          {/* Composer row */}
          <div className="flex items-start gap-3">
            <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/20">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-gradient-primary text-sm text-white">
                {profile?.display_name?.split(' ').map((n) => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <MentionTextarea
                placeholder={`What's on your mind, ${profile?.display_name?.split(' ')[0] || 'there'}?`}
                value={postContent}
                onValueChange={(v) => v.length <= MAX_CHARS && setPostContent(v)}
                style={{ fontSize: '17px' }}
                className="min-h-[90px] resize-none border-0 bg-transparent p-0 text-lg leading-snug focus-visible:ring-0"
                autoFocus
              />
              {showRestoredNotice && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">Picked up where you left off.</span>
                  <button type="button" onClick={() => { setPostContent(''); clearGhostDraft(); }} className="text-xs font-medium text-primary hover:underline">
                    Discard
                  </button>
                  <button type="button" onClick={dismissNotice} className="text-xs text-muted-foreground hover:underline">
                    Dismiss
                  </button>
                </div>
              )}
              {charCount > 0 && (
                <div className={cn('mt-1 text-right text-[11px]', charCount / MAX_CHARS > 0.9 ? 'text-destructive' : 'text-muted-foreground')}>
                  {charCount}/{MAX_CHARS}
                </div>
              )}
            </div>
          </div>

          {/* Media Preview */}
          <div className="mt-4">
            {previewMedia.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowGallerySheet(true)}
                className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ImageIcon className="h-6 w-6" />
                </span>
                <span className="text-sm font-medium">Add photos or videos</span>
              </button>
            ) : (
              <div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <ReorderableThumbs items={previewMedia} onReorder={reorderMedia} onRemove={removeMedia} />
                  {selectedMedia.length < 10 && (
                    <button
                      type="button"
                      onClick={() => setShowGallerySheet(true)}
                      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                      aria-label="Add more media"
                    >
                      <Plus className="h-6 w-6" />
                    </button>
                  )}
                </div>
                {previewMedia.length > 1 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Hold and drag a photo to change its order</p>
                )}

                {selectedMedia.map((f, i) => f.type.startsWith('video/') && (
                  <Button key={`edit-${i}`} type="button" variant="outline" size="sm" className="mr-2 mt-2 h-8 gap-1.5" onClick={() => setEditingVideoIndex(i)}>
                    <Scissors className="h-4 w-4" />
                    Edit video{selectedMedia.filter((x) => x.type.startsWith('video/')).length > 1 ? ` ${i + 1}` : ''} (trim / crop / blur)
                  </Button>
                ))}
                {selectedMedia.map((f, i) => f.type.startsWith('image/') && (
                  <Button key={`photo-edit-${i}`} type="button" variant="outline" size="sm" className="mr-2 mt-2 h-8 gap-1.5" onClick={() => setEditingPhotoIndex(i)}>
                    <Sparkles className="h-4 w-4" />
                    Edit photo{selectedMedia.filter((x) => x.type.startsWith('image/')).length > 1 ? ` ${i + 1}` : ''}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Option chips */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-border/60 py-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-2 rounded-full bg-muted/50 px-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-xs">{location || 'Location'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <Input placeholder="Add location..." value={location} onChange={(e) => setLocation(e.target.value)} />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-2 rounded-full bg-muted/50 px-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-xs">{scheduledDate ? 'Scheduled' : 'Schedule'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} disabled={(date) => date < new Date()} />
              </PopoverContent>
            </Popover>

            <Select value={privacy} onValueChange={(v: any) => setPrivacy(v)}>
              <SelectTrigger className="h-9 w-auto gap-2 rounded-full border-0 bg-muted/50 px-3">
                {getPrivacyIcon()}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public"><div className="flex items-center gap-2"><span>Public</span></div></SelectItem>
                <SelectItem value="friends"><div className="flex items-center gap-2"><UserCheck className="h-4 w-4" /><span>Friends</span></div></SelectItem>
                <SelectItem value="private"><div className="flex items-center gap-2"><Lock className="h-4 w-4" /><span>Only Me</span></div></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Drafts */}
          <div className="mt-4 flex items-center gap-2">
            <DraftsDialog onSelectDraft={handleLoadDraft} />
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full"
              onClick={handleSaveDraft}
              disabled={!postContent.trim() && selectedMedia.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save draft
            </Button>
          </div>
        </div>
      </div>

      <GalleryPickerSheet
        open={showGallerySheet}
        onOpenChange={setShowGallerySheet}
        multiple
        title="Add to your post"
        onSelect={(file) => addMediaFiles([file])}
        onSelectMany={(files) => addMediaFiles(files)}
      />
      <VideoEditorDialog
        file={editingVideoIndex !== null ? selectedMedia[editingVideoIndex] ?? null : null}
        open={editingVideoIndex !== null}
        onOpenChange={(o) => { if (!o) setEditingVideoIndex(null); }}
        onDone={(edited) => { if (editingVideoIndex !== null) replaceMedia(editingVideoIndex, edited); }}
      />
      <PhotoEditorDialog
        file={editingPhotoIndex !== null ? selectedMedia[editingPhotoIndex] ?? null : null}
        open={editingPhotoIndex !== null}
        onClose={() => setEditingPhotoIndex(null)}
        onDone={(edited) => { if (editingPhotoIndex !== null) replaceMedia(editingPhotoIndex, edited); }}
      />
    </div>
  );
};

export default CreatePostPage;