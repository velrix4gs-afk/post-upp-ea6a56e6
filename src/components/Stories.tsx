import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useStories, type Story } from '@/hooks/useStories';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { ProfileHoverCard } from '@/components/ProfileHoverCard';
import StoryViewer from '@/components/StoryViewer';
import { ensurePrivateChat } from '@/lib/chatCreation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const Stories = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
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
      toast({ description: 'Story reply sent' });
      return true;
    } catch (error) {
      console.error('[stories] failed to send story reply', error);
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
      {/* Floating stories - no background */}
      <div className="py-3 px-2">
        <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          <style>{`
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
          {/* Add Story - Floating circle with + */}
          <div className="flex-shrink-0 w-[72px] text-center cursor-pointer tap-scale" onClick={() => navigate('/create/story')}>
            <div className="relative w-[68px] h-[68px] mx-auto">
              <div className="w-[68px] h-[68px] rounded-full bg-background border-2 border-dashed border-primary/50 flex items-center justify-center hover:border-primary transition-all duration-300 hover:scale-105">
                {profile?.avatar_url ? (
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={profile.avatar_url} className="object-cover" />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {profile?.display_name?.[0] || '+'}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Plus className="h-7 w-7 text-primary" />
                )}
              </div>
              {/* Plus badge */}
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                <Plus className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
              </div>
            </div>
            <p className="text-[11px] mt-1.5 text-muted-foreground truncate font-medium">Your Story</p>
          </div>

          {/* Story Items - Floating circles */}
          {storyGroups.map(({ userId, stories: userStories }) => {
            const story = userStories[0];
            const latestStory = userStories[userStories.length - 1];
            const isOwnStory = userId === user?.id;
            const displayName = story.profiles.display_name || story.profiles.username || 'User';
            return (
              <div
                key={userId}
                className="flex-shrink-0 w-[72px] text-center cursor-pointer snap-start relative group tap-scale"
                onClick={() => handleStoryClick(story)}
                aria-label={`${displayName}, ${userStories.length} active ${userStories.length === 1 ? 'story' : 'stories'}`}
              >
                <ProfileHoverCard userId={userId}>
                  <div className="w-[68px] h-[68px] mx-auto relative">
                    <div className={`absolute inset-0 rounded-full p-[3px] ${isOwnStory ? 'bg-primary' : 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600'}`}>
                      <div className="w-full h-full rounded-full bg-background p-[2px]">
                        <Avatar className="w-full h-full">
                          <AvatarImage src={story.profiles.avatar_url} className="object-cover" />
                          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                            {displayName[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    {userStories.length > 1 && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-background px-1.5 text-[9px] font-semibold leading-4 text-foreground shadow">
                        {userStories.length}
                      </span>
                    )}
                    {isOwnStory && <Button size="sm" variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={e => handleDeleteStory(latestStory.id, e)} aria-label="Delete latest story">
                      <X className="h-3 w-3" />
                    </Button>}
                  </div>
                </ProfileHoverCard>
                <p className="text-[11px] mt-1.5 w-[72px] truncate font-medium">
                  {displayName.split(' ')[0]}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Story Viewer */}
      {selectedStoryId && selectedStoryIndex >= 0 && (
        <StoryViewer
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
export default Stories;
