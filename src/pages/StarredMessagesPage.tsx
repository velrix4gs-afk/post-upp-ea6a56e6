import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackNavigation } from '@/components/BackNavigation';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface StarredMessage {
  id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  created_at: string;
  chat_id: string;
  sender: {
    display_name: string;
    avatar_url?: string;
  };
  chat_name?: string;
}

const StarredMessagesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<StarredMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchStarredMessages = async () => {
      try {
        setLoading(true);
        const { data: starredRows, error: starredError } = await supabase
          .from('starred_messages')
          .select('message_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (starredError) throw starredError;

        const messageIds = (starredRows || []).map((row) => row.message_id);
        if (messageIds.length === 0) {
          if (!cancelled) setMessages([]);
          return;
        }

        const { data: messageRows, error: messagesError } = await supabase
          .from('messages')
          .select('id, content, media_url, media_type, created_at, chat_id, sender_id')
          .in('id', messageIds);
        if (messagesError) throw messagesError;

        const rows = messageRows || [];
        const senderIds = [...new Set(rows.map((message) => message.sender_id))];
        const chatIds = [...new Set(rows.map((message) => message.chat_id))];
        const [{ data: profiles, error: profilesError }, { data: chats, error: chatsError }] = await Promise.all([
          senderIds.length
            ? supabase.from('profiles').select('id, display_name, avatar_url').in('id', senderIds)
            : Promise.resolve({ data: [], error: null }),
          chatIds.length
            ? supabase.from('chats').select('id, name').in('id', chatIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (profilesError) throw profilesError;
        if (chatsError) throw chatsError;
        if (cancelled) return;

        const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
        const chatNamesById = new Map((chats || []).map((chat) => [chat.id, chat.name]));
        const messagesById = new Map(rows.map((message) => [message.id, message]));
        setMessages(messageIds.flatMap((id) => {
          const message = messagesById.get(id);
          if (!message) return [];
          const senderProfile = profilesById.get(message.sender_id);
          return [{
            id: message.id,
            content: message.content || '',
            media_url: message.media_url || undefined,
            media_type: message.media_type || undefined,
            created_at: message.created_at,
            chat_id: message.chat_id,
            sender: {
              display_name: senderProfile?.display_name || 'User',
              avatar_url: senderProfile?.avatar_url || undefined,
            },
            chat_name: chatNamesById.get(message.chat_id) || undefined,
          }];
        }));
      } catch (error) {
        console.error('Error fetching starred messages:', error);
        if (!cancelled) {
          setMessages([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchStarredMessages();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleMessageClick = (chatId: string) => {
    navigate(`/messages?chat=${chatId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BackNavigation title="Starred Messages" />
      
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <ScrollArea className="h-[calc(100vh-200px)]">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <Card className="p-12 text-center">
              <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No starred messages</h3>
              <p className="text-muted-foreground">
                Star messages to save them for later
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <Card
                  key={message.id}
                  className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleMessageClick(message.chat_id)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={message.sender.avatar_url} />
                      <AvatarFallback>{message.sender.display_name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold">{message.sender.display_name}</span>
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </div>
                      {message.chat_name && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <MessageSquare className="h-3 w-3" />
                          <span>{message.chat_name}</span>
                        </div>
                      )}
                      {message.media_url && (
                        <div className="mb-2">
                          {message.media_type?.startsWith('image') ? (
                            <img
                              src={message.media_url}
                              alt="Attachment"
                              className="rounded-lg max-w-xs max-h-48 object-cover"
                            />
                          ) : message.media_type?.startsWith('video') ? (
                            <video
                              src={message.media_url}
                              className="rounded-lg max-w-xs max-h-48"
                              controls
                            />
                          ) : null}
                        </div>
                      )}
                      {message.content && (
                        <p className="text-sm text-foreground mb-2 line-clamp-3">
                          {message.content}
                        </p>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </main>
    </div>
  );
};

export default StarredMessagesPage;
