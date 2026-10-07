import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { storyObjectPath, useStories, type Story } from '@/hooks/useStories';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, Plus } from 'lucide-react';
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

  const handleShareToFeed = async (story: Story): Promise<boolean> => {
    if (!user) return false;

    let uploadedPostPath: string | null = null;
    try {
      let mediaUrl: string | undefined;
      const storyMediaPath = story.media_path || (story.media_url ? storyObjectPath(story.media_url) : null);
      if (story.media_type && storyMediaPath) {
        const { data: file, error: downloadError } = await supabase.storage
          .from('stories')
          .download(storyMediaPath);
        if (downloadError) throw downloadError;

        const extension = storyMediaPath.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'bin';
        const uploadId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        uploadedPostPath = `${user.id}/${uploadId}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(uploadedPostPath, file, {
            upsert: false,
            contentType: file.type || `${story.media_type}/*`,
            cacheControl: '3600',
          });
        if (uploadError) throw uploadError;

        mediaUrl = supabase.storage.from('posts').getPublicUrl(uploadedPostPath).data.publicUrl;
      } else if (story.media_type) {
        throw new Error('This Showcase item has no reusable media file. Try sharing a text-only item.');
      }

      const { error: postError, data } = await supabase.functions.invoke('posts', {
        body: {
          content: story.content?.trim() || 'Shared from Showcase',
          media_url: mediaUrl,
          media_type: story.media_type || undefined,
          privacy: 'public',
        },
      });
      if (postError) throw postError;
      if (data?.error) throw new Error(String(data.error));
      uploadedPostPath = null;
      toast({ title: 'Shared to feed' });
      return true;
    } catch (error) {
      if (uploadedPostPath) {
        const { error: cleanupError } = await supabase.storage.from('posts').remove([uploadedPostPath]);
        if (cleanupError) console.error('Could not clean up failed Showcase post media upload:', cleanupError);
      }
      console.error('[showcase] failed to share to feed', error);
      toast({
        title: 'Could not share to feed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      return false;
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
        {/* Compact label row. The previous two-line heading plus icon took a
            full card's worth of vertical space above the tray. */}
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Showcase</h2>
          <Clapperboard className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <style>{`
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
          {/* Always offer a way to post, whether or not you have an active item.
              Without this the tray was read-only and posting meant finding the
              create menu. */}
          <div className="flex w-[76px] shrink-0 snap-start flex-col items-center gap-1.5">
            <button
              type="button"
              className="relative grid h-[68px] w-[68px] place-items-center rounded-full border-2 border-dashed border-primary/60 bg-primary/10 transition-transform duration-200 hover:scale-105 active:scale-95"
              onClick={() => navigate('/create/showcase')}
              aria-label="Add to your Showcase"
            >
              <Plus className="h-6 w-6 text-primary" aria-hidden="true" />
            </button>
            <span className="max-w-full truncate text-[11px] font-medium text-primary">
              Your Showcase
            </span>
          </div>
          {storyGroups.map(({ userId, stories: userStories }) => {
            const story = userStories[userStories.length - 1];
            const firstStory = userStories[0];
            const isOwnStory = userId === user?.id;
            // profiles is an embedded join and can be null (deleted profile, or a
            // row this viewer may not read). Unguarded this threw and blanked
            // the whole Showcase strip.
            const displayName = story.profiles?.display_name || story.profiles?.username || 'User';
            return (
              <div key={userId} className="flex w-[76px] shrink-0 snap-start flex-col items-center gap-1.5">
                <button
                  type="button"
                  className="relative h-[68px] w-[68px] rounded-full bg-gradient-to-br from-primary via-accent to-primary p-[2.5px] transition-transform duration-200 hover:scale-105 active:scale-95"
                  onClick={() => handleStoryClick(firstStory)}
                  aria-label={`Open ${displayName}'s Showcase, ${userStories.length} active ${userStories.length === 1 ? 'item' : 'items'}`}
                >
                  <Avatar className="h-full w-full border-2 border-background">
                    {story.media_url && story.media_type !== 'video' && (
                      <AvatarImage src={story.media_url} alt="" className="object-cover" />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-primary/30 via-accent/20 to-background text-base font-semibold">
                      {displayName[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {userStories.length > 1 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {userStories.length}
                    </span>
                  )}
                </button>
                <span className="max-w-full truncate text-[11px] text-muted-foreground">{isOwnStory ? 'You' : displayName}</span>
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
          onDelete={viewerStories[selectedStoryIndex].user_id === user?.id
            ? async (story) => {
                if (await deleteStory(story.id)) setSelectedStoryId(null);
              }
            : undefined}
          onShareToFeed={viewerStories[selectedStoryIndex].user_id === user?.id
            ? handleShareToFeed
            : undefined}
          onViewProfile={(story) => {
            const handle = story.profiles?.username;
            if (handle) navigate(`/profile/${handle}`);
          }}
          canReply={viewerStories[selectedStoryIndex].user_id !== user?.id}
        />
      )}
    </>;
};
export default Showcase;
