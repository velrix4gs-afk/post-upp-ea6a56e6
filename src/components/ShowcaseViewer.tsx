import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronLeft, ChevronRight, Heart, Loader2, MoreVertical, Send, X } from 'lucide-react';
import type { Story } from '@/hooks/useStories';
import { getCachedThumbnail } from '@/lib/videoThumbnail';

interface ShowcaseViewerProps {
  stories: Story[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReply: (story: Story, text: string) => Promise<boolean>;
  onDelete?: (story: Story) => Promise<void>;
  onShareToFeed?: (story: Story) => Promise<boolean>;
  onViewProfile?: (story: Story) => void;
  canReply?: boolean;
}

const IMAGE_DURATION_MS = 5000;

const ShowcaseViewer = ({
  stories,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
  onReply,
  onDelete,
  onShareToFeed,
  onViewProfile,
  canReply = true,
}: ShowcaseViewerProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeVideoAfterPress = useRef(false);
  const remainingImageDuration = useRef(IMAGE_DURATION_MS);
  const onNextRef = useRef(onNext);
  const currentStory = stories[currentIndex];
  const currentStoryId = currentStory?.id;
  const currentStoryMediaType = currentStory?.media_type;

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    setImageFailed(false);
    remainingImageDuration.current = IMAGE_DURATION_MS;
  }, [currentStoryId]);

  useEffect(() => {
    if (!currentStoryId || paused || currentStoryMediaType === 'video') return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      remainingImageDuration.current = IMAGE_DURATION_MS;
      onNextRef.current();
    }, remainingImageDuration.current);
    return () => {
      window.clearTimeout(timer);
      remainingImageDuration.current = Math.max(
        0,
        remainingImageDuration.current - (Date.now() - startedAt),
      );
    };
  }, [currentStoryId, currentStoryMediaType, paused]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight') onNext();
      if (event.key === 'ArrowLeft') onPrevious();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrevious]);

  if (!currentStory) return null;

  const handleReply = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      if (await onReply(currentStory, text)) setMessage('');
    } finally {
      setSending(false);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onNext();
      else onPrevious();
    } else if (dy > 90) {
      onClose();
    }
    setTouchStart(null);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (
      event.target instanceof Element &&
      event.target.closest('button, input, textarea, [role="menu"]')
    ) return;
    setTouchStart({
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    });
  };

  const handleStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest('button, input, textarea, [role="menu"], header')
    ) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left + bounds.width / 2) onPrevious();
    else onNext();
  };

  const handlePressStart = (event: React.PointerEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest('button, input, textarea')) return;
    setPaused(true);
    const video = videoRef.current;
    resumeVideoAfterPress.current = !!video && !video.paused;
    video?.pause();
  };

  const handlePressEnd = () => {
    if (resumeVideoAfterPress.current) {
      void videoRef.current?.play().catch(() => setPaused(false));
    }
    resumeVideoAfterPress.current = false;
    setPaused(false);
  };

  const storyName = currentStory.profiles.display_name || currentStory.profiles.username || 'User';

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-label={`${storyName}'s Showcase`}
        className="fixed inset-0 z-[200] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-black p-0 text-white shadow-2xl [&>button]:hidden"
      >
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-black">
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleStageClick}
            onPointerDown={handlePressStart}
            onPointerUp={handlePressEnd}
            onPointerCancel={handlePressEnd}
            onLostPointerCapture={handlePressEnd}
          >
            <div className="absolute inset-x-4 top-[max(env(safe-area-inset-top),16px)] z-20 flex gap-1.5" aria-label={`Showcase item ${currentIndex + 1} of ${stories.length}`}>
              {stories.map((story, index) => (
                <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div
                    key={`${story.id}-${index === currentIndex ? 'current' : 'static'}`}
                    className={`h-full bg-white ${index < currentIndex ? 'w-full' : index > currentIndex ? 'w-0' : 'w-full animate-[story-progress_5s_linear_forwards]'}`}
                    style={{ animationPlayState: index === currentIndex && paused ? 'paused' : 'running' }}
                  />
                </div>
              ))}
            </div>
            <header className="absolute inset-x-4 top-[max(calc(env(safe-area-inset-top)+24px),40px)] z-20 flex items-center gap-2 text-white">
              <Avatar className="h-9 w-9 border border-white/70">
                <AvatarImage src={currentStory.profiles.avatar_url} />
                <AvatarFallback>{storyName[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{storyName}</p>
                <p className="text-xs text-white/70">
                  {new Date(currentStory.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 rounded-full text-white hover:bg-white/15"
                aria-label="Close Showcase"
              >
                <X className="h-5 w-5" />
              </Button>
              {(onDelete || onShareToFeed || onViewProfile) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full text-white hover:bg-white/15"
                      aria-label="Showcase options"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onShareToFeed && (
                      <DropdownMenuItem
                        disabled={sharing}
                        onSelect={(event) => {
                          event.preventDefault();
                          setSharing(true);
                          void onShareToFeed(currentStory).finally(() => setSharing(false));
                        }}
                      >
                        {sharing ? 'Sharing…' : 'Share to feed'}
                      </DropdownMenuItem>
                    )}
                    {onViewProfile && (
                      <DropdownMenuItem onSelect={() => {
                        onClose();
                        onViewProfile(currentStory);
                      }}>
                        View profile
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <>
                        {(onShareToFeed || onViewProfile) && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setConfirmDelete(true)}
                        >
                          Delete Showcase item
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </header>

            {!currentStory.media_url && currentStory.content ? (
              // Text-only Showcase item: no media was uploaded, so there is
              // nothing to render as an image or video. Previously this fell
              // through to a blank black screen.
              <div
                key={currentStory.id}
                className="flex h-full w-full items-center justify-center px-8"
              >
                <p className="max-w-xl whitespace-pre-wrap text-center text-2xl font-semibold leading-snug text-white drop-shadow-lg sm:text-3xl">
                  {currentStory.content}
                </p>
              </div>
            ) : currentStory.media_url ? currentStory.media_type === 'video' ? (
              <video
                key={currentStory.id}
                ref={videoRef}
                src={currentStory.media_url}
                // Poster so the frame is never black while the video buffers.
                poster={getCachedThumbnail(currentStory.media_url) ?? undefined}
                className="h-full w-full object-contain"
                autoPlay
                muted
                playsInline
                preload="auto"
                onPlay={() => setPaused(false)}
                onPause={() => setPaused(true)}
                onEnded={onNext}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <img
                key={currentStory.id}
                src={currentStory.media_url}
                alt={`${storyName}'s Showcase item`}
                className="max-h-full max-w-full select-none object-contain"
                draggable={false}
                onError={() => setImageFailed(true)}
              />
            ) : (
              // No media and no content: nothing to show. Should not happen,
              // but never leave the user staring at a black screen.
              <div className="flex h-full w-full items-center justify-center px-8 text-center text-white/70">
                <p className="text-base">This Showcase item is empty.</p>
              </div>
            )}
            {imageFailed && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-8 text-center text-sm text-white/80">
                This Showcase {currentStory.media_type === 'video' ? 'video' : 'image'} could not be loaded.
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={onPrevious}
              className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 rounded-full shadow-lg sm:flex"
              aria-label="Previous Showcase item"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={onNext}
              className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 rounded-full shadow-lg sm:flex"
              aria-label="Next Showcase item"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            {currentStory.content && currentStory.media_url && (
              <p className="absolute inset-x-5 bottom-5 line-clamp-3 rounded-2xl border border-white/15 bg-black/65 px-4 py-3 text-center text-sm font-medium text-white shadow-xl md:hidden">
                {currentStory.content}
              </p>
            )}
          </div>

          {canReply && (
            <form
              className="absolute inset-x-4 bottom-[max(env(safe-area-inset-bottom),16px)] z-20 mx-auto flex max-w-xl items-center gap-2 rounded-full border border-white/15 bg-black/65 p-1.5 backdrop-blur-md"
              onSubmit={(event) => {
                event.preventDefault();
                void handleReply();
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full text-white hover:bg-white/15"
                aria-label="Add a heart to your reply"
                onClick={() => {
                  setMessage((text) => `${text}❤️`);
                  inputRef.current?.focus();
                }}
              >
                <Heart className="h-5 w-5" />
              </Button>
              <Input
                ref={inputRef}
                placeholder="Reply to Showcase..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                className="h-10 min-w-0 rounded-full border-0 bg-transparent text-white placeholder:text-white/60 focus-visible:ring-0"
              />
              <Button
                type="submit"
                size="icon"
                variant="secondary"
                className="h-10 w-10 shrink-0 rounded-full"
                disabled={!message.trim() || sending}
                aria-label="Send Showcase reply"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this Showcase item?</AlertDialogTitle>
          <AlertDialogDescription>This item will be removed from your Showcase.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep item</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (!onDelete) return;
              void onDelete(currentStory).finally(() => setConfirmDelete(false));
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default ShowcaseViewer;
