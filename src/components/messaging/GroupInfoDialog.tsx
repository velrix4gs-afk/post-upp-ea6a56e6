import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, UserPlus, UserMinus, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface GroupInfoDialogProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Participant {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

export const GroupInfoDialog = ({ chatId, open, onOpenChange }: GroupInfoDialogProps) => {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && chatId) {
      fetchParticipants();
    }
  }, [open, chatId]);

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_participants')
        .select('user_id, role, joined_at')
        .eq('chat_id', chatId);

      if (error) throw error;

      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(p => p.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', userIds);

        const participantsWithProfiles = data.map(p => ({
          ...p,
          profiles: profiles?.find(prof => prof.id === p.user_id) || {
            username: 'unknown',
            display_name: 'Unknown User',
            avatar_url: undefined,
          },
        }));

        setParticipants(participantsWithProfiles);
        
        const myRole = participantsWithProfiles.find(p => p.user_id === user?.id)?.role;
        setIsAdmin(myRole === 'admin');
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!isAdmin) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', userId);

      if (error) throw error;

      await fetchParticipants();
      toast({ title: 'Participant removed' });
    } catch (error) {
      toast({ title: 'Failed to remove participant', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({ title: 'Left group' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Failed to leave group', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Group Members ({participants.length})
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {participants.map((participant) => (
              <div
                key={participant.user_id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={participant.profiles?.avatar_url} />
                    <AvatarFallback>
                      {participant.profiles?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{participant.profiles?.display_name || 'User'}</p>
                    <p className="text-sm text-muted-foreground">
                      @{participant.profiles?.username || ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {participant.role === 'admin' && (
                    <Badge variant="secondary" className="gap-1">
                      <Crown className="h-3 w-3" />
                      Admin
                    </Badge>
                  )}
                  
                  {isAdmin && participant.user_id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveParticipant(participant.user_id)}
                      disabled={loading}
                    >
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          {isAdmin && (
            <Button variant="outline" className="flex-1 gap-2">
              <UserPlus className="h-4 w-4" />
              Add Members
            </Button>
          )}
          
          <Button
            variant="destructive"
            onClick={handleLeaveGroup}
            disabled={loading}
            className="flex-1 gap-2"
          >
            <LogOut className="h-4 w-4" />
            Leave Group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
