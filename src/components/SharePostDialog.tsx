import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Send, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { showCleanError } from '@/lib/errorHandler';

interface SharePostDialogProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SharePostDialog = ({ postId, open, onOpenChange }: SharePostDialogProps) => {
  const { user } = useAuth();
  const { friends } = useFriends();
  const [search, setSearch] = useState('');
  const [sharing, setSharing] = useState(false);

  const filteredFriends = friends.filter(friend =>
    friend.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleShare = async (friendId: string) => {
    if (!user) return;

    setSharing(true);
    try {
      // First, check if user has an existing chat with this friend
      const { data: existingChats } = await supabase
        .from('chat_participants')
        .select('chat_id, chats!inner(type)')
        .eq('user_id', user.id);

      let chatId = null;
      
      if (existingChats) {
        for (const ec of existingChats) {
          const { data: otherParticipant } = await supabase
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', ec.chat_id)
            .eq('user_id', friendId)
            .maybeSingle();

          if (otherParticipant) {
            chatId = ec.chat_id;
            break;
          }
        }
      }

      // If no chat exists, create one
      if (!chatId) {
        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({ type: 'private', created_by: user.id })
          .select()
          .single();

        if (chatError) throw chatError;

        const { error: participantsError } = await supabase
          .from('chat_participants')
          .insert([
            { chat_id: newChat.id, user_id: user.id, role: 'member' },
            { chat_id: newChat.id, user_id: friendId, role: 'member' }
          ]);

        if (participantsError) throw participantsError;
        chatId = newChat.id;
      }

      // Share the post as a message
      const { data: post } = await supabase
        .from('posts')
        .select('content')
        .eq('id', postId)
        .single();

      const shareMessage = `🔗 Shared post: "${post?.content?.slice(0, 100)}${post?.content && post.content.length > 100 ? '...' : ''}"`;

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          content: shareMessage,
          reply_to_id: null,
        });

      if (messageError) throw messageError;

      toast({ title: 'Post shared successfully!' });
      onOpenChange(false);
    } catch (error: any) {
      console.error('[SHARE_001] Error sharing post:', error);
      showCleanError(error, toast, 'Failed to share post');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search friends..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No friends found</p>
              </div>
            ) : (
              filteredFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={friend.avatar_url} />
                      <AvatarFallback>
                        {friend.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{friend.display_name}</p>
                      {friend.username && (
                        <p className="text-sm text-muted-foreground">@{friend.username}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleShare(friend.id)}
                    disabled={sharing}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
