import { useState } from 'react';
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
  const selectedStoryIndex = selectedStoryId
    ? stories.findIndex((story) => story.id === selectedStoryId)
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
    if (index >= stories.length) {
      setSelectedStoryId(null);
      return;
    }
    setSelectedStoryId(stories[index].id);
    void viewStory(stories[index].id);
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
          {stories.map(story => <div key={story.id} className="flex-shrink-0 w-[72px] text-center cursor-pointer snap-start relative group tap-scale" onClick={() => handleStoryClick(story)}>
              <ProfileHoverCard userId={story.user_id}>
                <div className="w-[68px] h-[68px] mx-auto relative">
                  {/* Gradient ring */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[3px]">
                    <div className="w-full h-full rounded-full bg-background p-[2px]">
                      <Avatar className="w-full h-full">
                        <AvatarImage src={story.profiles.avatar_url} className="object-cover" />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {story.profiles.display_name[0]}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  {story.user_id === user?.id && <Button size="sm" variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10" onClick={e => handleDeleteStory(story.id, e)}>
                      <X className="h-3 w-3" />
                    </Button>}
                </div>
              </ProfileHoverCard>
              <p className="text-[11px] mt-1.5 w-[72px] truncate font-medium">
                {story.profiles.display_name.split(' ')[0]}
              </p>
            </div>)}
        </div>
      </div>

      {/* Story Viewer */}
      {selectedStoryId && selectedStoryIndex >= 0 && (
        <StoryViewer
          stories={stories}
          currentIndex={selectedStoryIndex}
          onClose={() => setSelectedStoryId(null)}
          onNext={() => goToStory(selectedStoryIndex + 1)}
          onPrevious={() => goToStory(selectedStoryIndex - 1)}
          onReply={handleReply}
          canReply={stories[selectedStoryIndex].user_id !== user?.id}
        />
      )}
    </>;
};
export default Stories;
