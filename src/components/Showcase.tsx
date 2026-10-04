import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useStories, type Story } from '@/hooks/useStories';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, X } from 'lucide-react';
import ShowcaseViewer from '@/components/ShowcaseViewer';
import { ensurePrivateChat } from '@/lib/chatCreation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const Showcase = () => {
  const { user } = useAuth();
  const { stories, viewStory, deleteStory } = useStories();
  const navigate = useNavigate();
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const storyGroups = useMemo(() => {
    const groups = new Map<string, Story[]>();
    stories.forEach((story) => {
      const group = groups.get(story.user_id) ?? [];
      group.push(story);
      groups.set(story.user_id, group);
    });

    return [...groups.entries()]
      .map(([userId, userStories]) => ({
        userId,
        stories: userStories.sort(
          (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
        ),
      }))
      .sort((left, right) => {
        const leftLatest = left.stories[left.stories.length - 1];
        const rightLatest = right.stories[right.stories.length - 1];
        return new Date(rightLatest.created_at).getTime() - new Date(leftLatest.created_at).getTime();
      });
  }, [stories]);
  const viewerStories = useMemo(() => storyGroups.flatMap((group) => group.stories), [storyGroups]);
  const selectedStoryIndex = selectedStoryId
    ? viewerStories.findIndex((story) => story.id === selectedStoryId)
    : -1;

  const handleStoryClick = (story: Story) => {
    setSelectedStoryId(story.id);
    void viewStory(story.id);
  };

  const handleDeleteStory = async (storyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteStory(storyId);
    if (selectedStoryId === storyId) {
      setSelectedStoryId(null);
    }
  };

  const handleReply = async (story: Story, text: string): Promise<boolean> => {
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
      setSelectedStoryId(null);
      navigate(`/messages?chat=${chatId}`);
      toast({ description: 'Showcase reply sent' });
      return true;
    } catch (error) {
      console.error('[showcase] failed to send reply', error);
      toast({
        title: 'Could not send reply',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const goToStory = (index: number) => {
    if (index < 0) {
      setSelectedStoryId(null);
      return;
    }
    if (index >= viewerStories.length) {
      setSelectedStoryId(null);
      return;
    }
    setSelectedStoryId(viewerStories[index].id);
    void viewStory(viewerStories[index].id);
  };

  return <>
      <section aria-label="Showcase" className="px-4 py-3">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Showcase</h2>
            <p className="text-xs text-muted-foreground">Recent moments, gathered in one place</p>
          </div>
          <Clapperboard className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <style>{`
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
          {storyGroups.map(({ userId, stories: userStories }) => {
            const story = userStories[userStories.length - 1];
            const firstStory = userStories[0];
            const isOwnStory = userId === user?.id;
            const displayName = story.profiles.display_name || story.profiles.username || 'User';
            return (
              <div key={userId} className="group relative h-32 w-52 shrink-0 snap-start">
                <button
                  type="button"
                  className="relative h-full w-full overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                  onClick={() => handleStoryClick(firstStory)}
                  aria-label={`Open ${displayName}'s Showcase, ${userStories.length} active ${userStories.length === 1 ? 'item' : 'items'}`}
                >
                  {story.media_url ? (
                    story.media_type === 'video' ? (
                      <video
                        src={story.media_url}
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={story.media_url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-accent/40 to-background" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/20" />
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    <Avatar className="h-8 w-8 border border-white/70">
                      <AvatarImage src={story.profiles.avatar_url} className="object-cover" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                        {displayName[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    {userStories.length > 1 && (
                      <span className="rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
                        {userStories.length} items
                      </span>
                    )}
                  </div>
                  <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-sm font-semibold leading-tight text-white">
                    {story.content || displayName}
                  </span>
                </button>
                {isOwnStory && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full opacity-100 shadow transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={(event) => handleDeleteStory(story.id, event)}
                    aria-label="Delete latest Showcase item"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {selectedStoryId && selectedStoryIndex >= 0 && (
        <ShowcaseViewer
          stories={viewerStories}
          currentIndex={selectedStoryIndex}
          onClose={() => setSelectedStoryId(null)}
          onNext={() => goToStory(selectedStoryIndex + 1)}
          onPrevious={() => goToStory(selectedStoryIndex - 1)}
          onReply={handleReply}
          canReply={viewerStories[selectedStoryIndex].user_id !== user?.id}
        />
      )}
    </>;
};
export default Showcase;
