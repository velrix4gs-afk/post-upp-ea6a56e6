import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { useStoryHighlights, type StoryHighlight } from '@/hooks/useStoryHighlights';
import { useStories, type Story } from '@/hooks/useStories';
import { useAuth } from '@/hooks/useAuth';
import { ensurePrivateChat } from '@/lib/chatCreation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import StoryViewer from '@/components/StoryViewer';
import { Skeleton } from '@/components/ui/skeleton';

interface StoryHighlightsProps {
  userId: string;
  isOwnProfile: boolean;
}

export const StoryHighlights = ({ userId, isOwnProfile }: StoryHighlightsProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { stories, viewStory } = useStories();
  const {
    highlights,
    loading,
    createHighlight,
    addStoriesToHighlight,
    fetchHighlightStories,
    deleteHighlight,
  } = useStoryHighlights(userId);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [viewerStories, setViewerStories] = useState<Story[]>([]);
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [deleteTarget, setDeleteTarget] = useState<StoryHighlight | null>(null);
  const activeOwnStories = useMemo(
    () => stories.filter((story) =>
      story.user_id === userId &&
      story.expires_at &&
      new Date(story.expires_at).getTime() > Date.now()
    ),
    [stories, userId],
  );

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto py-4">
        {[1, 2, 3].map((index) => (
          <div key={index} className="flex flex-col items-center gap-2 min-w-[80px]">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (!loading && highlights.length === 0 && !isOwnProfile) return null;

  const toggleStory = (storyId: string) => {
    setSelectedStoryIds((previous) => {
      const next = new Set(previous);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  };

  const handleCreate = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle || selectedStoryIds.size === 0 || saving) return;
    setSaving(true);
    try {
      const selectedStories = activeOwnStories.filter((story) => selectedStoryIds.has(story.id));
      const firstImage = selectedStories.find((story) => story.media_type === 'image')?.media_url;
      const highlightId = await createHighlight(cleanTitle, firstImage);
      if (!highlightId) return;
      const added = await addStoriesToHighlight(highlightId, selectedStories.map((story) => story.id));
      if (!added) return;
      setCreateOpen(false);
      setTitle('');
      setSelectedStoryIds(new Set());
    } finally {
      setSaving(false);
    }
  };

  const openHighlight = async (highlight: StoryHighlight) => {
    if (openingId) return;
    setOpeningId(highlight.id);
    const highlightStories = await fetchHighlightStories(highlight.id);
    setOpeningId(null);
    if (highlightStories.length === 0) {
      toast({
        title: 'No active stories',
        description: 'The stories in this highlight have expired or are no longer available.',
      });
      return;
    }
    setViewerStories(highlightStories);
    setViewerIndex(0);
    if (highlightStories[0].user_id !== user?.id) void viewStory(highlightStories[0].id);
  };

  const closeViewer = () => {
    setViewerStories([]);
    setViewerIndex(-1);
  };

  const goToViewerStory = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= viewerStories.length) {
      closeViewer();
      return;
    }
    setViewerIndex(nextIndex);
    const story = viewerStories[nextIndex];
    if (story.user_id !== user?.id) void viewStory(story.id);
  };

  const replyToStory = async (story: Story, text: string): Promise<boolean> => {
    if (!user || story.user_id === user.id) return false;
    try {
      const chatId = await ensurePrivateChat(user.id, story.user_id);
      const { error } = await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        content: text,
        status: 'sent',
      });
      if (error) throw error;
      closeViewer();
      navigate(`/messages?chat=${chatId}`);
      toast({ description: 'Story reply sent' });
      return true;
    } catch (error) {
      console.error('Failed to reply to highlighted story:', error);
      toast({
        title: 'Could not send reply',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (await deleteHighlight(deleteTarget.id)) setDeleteTarget(null);
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto py-4 scrollbar-hide">
        {isOwnProfile && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex flex-col items-center gap-2 min-w-[80px] group"
            aria-label="Create story highlight"
          >
            <div className="h-16 w-16 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center group-hover:border-primary group-hover:scale-105 transition-all duration-200">
              <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">New</span>
          </button>
        )}

        {highlights.map((highlight) => (
          <div key={highlight.id} className="relative flex flex-col items-center gap-2 min-w-[80px] group">
            <button
              type="button"
              onClick={() => void openHighlight(highlight)}
              disabled={openingId === highlight.id}
              className="flex flex-col items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
              aria-label={`Open ${highlight.title} story highlight`}
            >
              {openingId === highlight.id ? (
                <div className="h-16 w-16 rounded-full ring-2 ring-primary flex items-center justify-center bg-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : (
                <Avatar className="h-16 w-16 ring-2 ring-primary group-hover:scale-105 transition-transform duration-200">
                  <AvatarImage src={highlight.cover_image} />
                  <AvatarFallback><ImageIcon className="h-5 w-5" /></AvatarFallback>
                </Avatar>
              )}
              <span className="text-xs text-center line-clamp-2 group-hover:text-primary transition">
                {highlight.title}
              </span>
            </button>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setDeleteTarget(highlight)}
                className="absolute -top-1 right-0 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label={`Delete ${highlight.title} highlight`}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create story highlight</DialogTitle>
            <DialogDescription>
              Group active stories under a title. Stories saved here stay available on your profile after their 24-hour story window.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Highlight title"
            maxLength={40}
            autoFocus
          />
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            {activeOwnStories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                You need an active story before creating a highlight.
              </p>
            ) : activeOwnStories.map((story) => (
              <label
                key={story.id}
                className="flex items-center gap-3 rounded-xl p-2 hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedStoryIds.has(story.id)}
                  onChange={() => toggleStory(story.id)}
                  className="h-4 w-4 accent-primary"
                />
                {story.media_url ? (
                  <img src={story.media_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-primary" />
                  </div>
                )}
                <span className="text-sm line-clamp-2">{story.content || 'Story'}</span>
              </label>
            ))}
          </div>
          <Button
            onClick={() => void handleCreate()}
            disabled={saving || !title.trim() || selectedStoryIds.size === 0}
            className="w-full"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {saving ? 'Creating…' : 'Create highlight'}
          </Button>
        </DialogContent>
      </Dialog>

      {viewerIndex >= 0 && viewerStories[viewerIndex] && (
        <StoryViewer
          stories={viewerStories}
          currentIndex={viewerIndex}
          onClose={closeViewer}
          onNext={() => goToViewerStory(viewerIndex + 1)}
          onPrevious={() => goToViewerStory(viewerIndex - 1)}
          onReply={replyToStory}
          canReply={viewerStories[viewerIndex].user_id !== user?.id}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertTitle>Delete this highlight?</AlertTitle>
            <AlertDescription>
              “{deleteTarget?.title}” will be removed from your profile. The original stories are not deleted.
            </AlertDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} className="bg-destructive text-destructive-foreground">
              Delete highlight
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
