import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Image as ImageIcon, MapPin, Clock, Globe, Lock, UserCheck,
  Scissors, Sparkles, Plus, Loader2, ChevronRight, Users
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
          message: `${file.name} exceeds your ${formatMB(limitMB)} ${isVideo ? 'video' : 'photo'} limit`,
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
      showCleanError({ code: 'POST_001', message: 'Maximum 10 items per post.' }, toast);
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
      if (uploadError) throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
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
        if (mediaUrls.length === 0) { setIsPosting(false); return; }
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

      toast({ title: 'Posted!', description: 'Your post is now live' });
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

  const getPrivacyIcon = () => {
    switch (privacy) {
      case 'public': return <Globe className="h-4 w-4" />;
      case 'friends': return <UserCheck className="h-4 w-4" />;
      case 'private': return <Lock className="h-4 w-4" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#121212] text-white" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full h-10 w-10" onClick={() => navigate(-1)}>
          <X className="h-6 w-6" />
        </Button>
        <span className="font-semibold text-base">New post</span>
        <Button size="sm" className="rounded-full bg-blue-500 hover:bg-blue-600 font-semibold px-5 h-9 text-white" disabled={!canPost} onClick={handlePost}>
          {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Share'}
        </Button>
      </div>

      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="h-1 shrink-0 bg-white/10"><div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
      )}

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        <div className="mx-auto w-full max-w-2xl px-4 pt-4">

          {/* Media Preview - Big and Centered */}
          <div className="mb-6 flex flex-col items-center">
            {previewMedia.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowGallerySheet(true)}
                className="flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/5 text-white/60 transition-colors hover:bg-white/10"
              >
                <ImageIcon className="h-10 w-10" />
                <span className="text-sm font-medium">Select Photos or Videos</span>
              </button>
            ) : (
              <div className="w-full max-w-sm">
                {/* Show first media as big preview */}
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
                  {selectedMedia[0]?.type.startsWith('video/') ? (
                    <video src={previewMedia[0]} className="h-full w-full object-cover" autoPlay loop muted playsInline />
                  ) : (
                    <img src={previewMedia[0]} className="h-full w-full object-cover" />
                  )}
                  <button onClick={() => removeMedia(0)} className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Thumbnail strip for multi-select */}
                {previewMedia.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {previewMedia.slice(1).map((url, i) => (
                      <div key={i} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                        <img src={url} className="h-full w-full object-cover" />
                      </div>
                    ))}
                    {selectedMedia.length < 10 && (
                      <button onClick={() => setShowGallerySheet(true)} className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/5">
                        <Plus className="h-6 w-6 text-white/60" />
                      </button>
                    )}
                  </div>
                )}

                {/* Video Edit Button */}
                {selectedMedia.some(f => f.type.startsWith('video/')) && (
                  <Button variant="outline" className="w-full mt-3 border-white/20 text-white hover:bg-white/10 rounded-xl" onClick={() => setEditingVideoIndex(selectedMedia.findIndex(f => f.type.startsWith('video/')))}>
                    <Scissors className="h-4 w-4 mr-2" /> Edit video
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Caption Input */}
          <div className="flex items-start gap-3 border-b border-white/10 pb-4">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-white/10 text-xs">{profile?.display_name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <MentionTextarea
                placeholder="Write a caption..."
                value={postContent}
                onValueChange={(v) => v.length <= MAX_CHARS && setPostContent(v)}
                className="min-h-[60px] w-full resize-none border-0 bg-transparent p-0 text-[15px] focus-visible:ring-0 text-white placeholder:text-white/40"
              />
            </div>
          </div>

          {/* Options List (Instagram Style) */}
          <div className="mt-4 flex flex-col text-sm">
            {/* Location */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex w-full items-center justify-between py-3.5 border-b border-white/10 hover:bg-white/5 px-1 transition-colors">
                  <div className="flex items-center gap-3 text-white/90">
                    <MapPin className="h-5 w-5" />
                    <span>{location || 'Add location'}</span>
                  </div>
                  {location ? <span className="text-xs text-blue-400">Change</span> : <ChevronRight className="h-5 w-5 text-white/40" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-[#1e1e1e] border-white/10">
                <Input placeholder="Search location..." value={location} onChange={(e) => setLocation(e.target.value)} className="bg-white/5 border-white/10 text-white" />
              </PopoverContent>
            </Popover>

            {/* Schedule */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex w-full items-center justify-between py-3.5 border-b border-white/10 hover:bg-white/5 px-1 transition-colors">
                  <div className="flex items-center gap-3 text-white/90">
                    <Clock className="h-5 w-5" />
                    <span>{scheduledDate ? 'Scheduled' : 'Schedule post'}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/40" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#1e1e1e] border-white/10" align="start">
                <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} disabled={(date) => date < new Date()} className="text-white" />
              </PopoverContent>
            </Popover>

            {/* Audience */}
            <Select value={privacy} onValueChange={(v: any) => setPrivacy(v)}>
              <SelectTrigger className="w-full flex items-center justify-between py-3.5 border-b border-white/10 hover:bg-white/5 px-1 bg-transparent border-0 rounded-none h-auto text-[15px] focus:ring-0">
                <div className="flex items-center gap-3 text-white/90">
                  {getPrivacyIcon()}
                  <span>Audience</span>
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  <span className="capitalize">{privacy}</span>
                  <ChevronRight className="h-5 w-5" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e1e] border-white/10 text-white">
                <SelectItem value="public">Public (Everyone)</SelectItem>
                <SelectItem value="friends">Friends only</SelectItem>
                <SelectItem value="private">Only me</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-0 inset-x-0 border-t border-white/10 bg-[#121212] p-4 flex items-center gap-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
        <DraftsDialog onSelectDraft={handleLoadDraft} />
        <Button variant="outline" className="flex-1 h-11 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={handleSaveDraft} disabled={!postContent.trim() && selectedMedia.length === 0}>
          Save draft
        </Button>
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