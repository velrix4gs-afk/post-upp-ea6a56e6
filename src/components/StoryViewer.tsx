import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Heart, Loader2, Send, X } from 'lucide-react';
import type { Story } from '@/hooks/useStories';

interface StoryViewerProps {
  stories: Story[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReply: (story: Story, text: string) => Promise<boolean>;
  canReply?: boolean;
}

const IMAGE_DURATION_MS = 5000;

const StoryViewer = ({
  stories,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
  onReply,
  canReply = true,
}: StoryViewerProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentStory = stories[currentIndex];
  const currentStoryId = currentStory?.id;
  const currentStoryMediaType = currentStory?.media_type;

  useEffect(() => {
    setImageFailed(false);
  }, [currentStoryId]);

  useEffect(() => {
    if (!currentStoryId || paused || currentStoryMediaType === 'video') return;
    const timer = window.setTimeout(onNext, IMAGE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [currentStoryId, currentStoryMediaType, onNext, paused]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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

  const storyName = currentStory.profiles.display_name || currentStory.profiles.username || 'User';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-label={`${storyName}'s story`}
        className="fixed left-0 top-0 z-[200] h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-black p-0 text-white shadow-none [&>button]:hidden"
      >
        <div
          className="relative mx-auto flex h-full w-full max-w-[min(100vw,520px)] flex-col overflow-hidden bg-black sm:my-auto sm:h-[min(100dvh,920px)] sm:rounded-2xl"
          onTouchStart={(event) => setTouchStart({
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          })}
          onTouchEnd={handleTouchEnd}
        >
          {currentStory.media_url && currentStory.media_type !== 'video' && (
            <div
              className="absolute inset-0 scale-110 bg-cover bg-center opacity-35 blur-3xl"
              style={{ backgroundImage: `url("${currentStory.media_url}")` }}
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />

          <div className="relative z-10 flex h-full min-h-0 flex-col px-3 pt-[max(env(safe-area-inset-top),12px)] pb-[max(env(safe-area-inset-bottom),12px)]">
            <div className="flex gap-1" aria-label={`Story ${currentIndex + 1} of ${stories.length}`}>
              {stories.map((story, index) => (
                <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                  <div
                    key={`${story.id}-${index === currentIndex ? 'current' : 'static'}`}
                    className={`h-full bg-white ${index < currentIndex ? 'w-full' : index > currentIndex ? 'w-0' : paused ? 'w-1/3' : 'w-full animate-[story-progress_5s_linear_forwards]'}`}
                  />
                </div>
              ))}
            </div>

            <header className="mt-3 flex items-center gap-2">
              <Avatar className="h-10 w-10 ring-1 ring-white/70">
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
                aria-label="Close story"
              >
                <X className="h-5 w-5" />
              </Button>
            </header>

            <div className="relative flex min-h-0 flex-1 items-center justify-center py-3">
              {currentStory.media_url ? currentStory.media_type === 'video' ? (
                <video
                  key={currentStory.id}
                  src={currentStory.media_url}
                  className="h-full w-full object-contain"
                  autoPlay
                  playsInline
                  onPlay={() => setPaused(false)}
                  onPause={() => setPaused(true)}
                  onEnded={onNext}
                  onClick={(event) => {
                    const video = event.currentTarget;
                    if (video.paused) void video.play();
                    else video.pause();
                  }}
                />
              ) : (
                <img
                  key={currentStory.id}
                  src={currentStory.media_url}
                  alt={`${storyName}'s story`}
                  className="max-h-full max-w-full select-none object-contain"
                  draggable={false}
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-8 text-center">
                  <p className="text-2xl font-semibold leading-relaxed">{currentStory.content}</p>
                </div>
              )}
              {imageFailed && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-8 text-center text-sm text-white/80">
                  This story image could not be loaded.
                </div>
              )}

              {currentStory.content && currentStory.media_url && (
                <p className="absolute inset-x-4 bottom-5 rounded-xl bg-black/35 px-4 py-3 text-center text-base font-medium shadow-lg backdrop-blur-sm">
                  {currentStory.content}
                </p>
              )}

              <button
                type="button"
                aria-label="Previous story"
                onClick={onPrevious}
                className="absolute inset-y-0 left-0 w-[22%]"
              />
              <button
                type="button"
                aria-label="Next story"
                onClick={onNext}
                className="absolute inset-y-0 right-0 w-[22%]"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full text-white/80 hover:bg-black/25 sm:flex"
                aria-label="Previous story"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onNext}
                className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full text-white/80 hover:bg-black/25 sm:flex"
                aria-label="Next story"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>

            {canReply && <form
              className="relative z-10 flex items-center gap-2"
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
                aria-label="Send heart reaction"
                onClick={() => {
                  setMessage((text) => `${text}❤️`);
                  inputRef.current?.focus();
                }}
              >
                <Heart className="h-5 w-5" />
              </Button>
              <Input
                ref={inputRef}
                placeholder="Reply to story..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                className="h-11 rounded-full border-white/40 bg-black/25 text-white placeholder:text-white/70"
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="h-10 w-10 shrink-0 rounded-full text-white hover:bg-white/15"
                disabled={!message.trim() || sending}
                aria-label="Send story reply"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </form>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryViewer;
