import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, Users } from 'lucide-react';
import { useFollowers } from '@/hooks/useFollowers';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface GroupChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated: (chatId: string) => void;
}

export const GroupChatDialog = ({ open, onOpenChange, onGroupCreated }: GroupChatDialogProps) => {
  const { user } = useAuth();
  const { following } = useFollowers();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const friends = following.map(f => f.following).filter(Boolean);
  const filteredFriends = friends.filter(friend =>
    !searchQuery.trim() ||
    friend.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setAvatarPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGroup = async () => {
    console.log('[GroupChatDialog] Creating group with:', {
      groupName,
      selectedMembers: selectedMembers.length,
      hasAvatar: !!avatarFile
    });

    if (!groupName.trim()) {
      toast({ title: 'Group name required', variant: 'destructive' });
      return;
    }

    if (selectedMembers.length === 0) {
      toast({ 
        title: 'Add at least one member', 
        description: 'You need to select friends to add to the group',
        variant: 'destructive' 
      });
      return;
    }

    if (!user?.id) {
      console.error('[GroupChatDialog] No user ID found');
      toast({ title: 'Authentication error', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      // Upload avatar if provided
      let avatarUrl = null;
      if (avatarFile) {
        console.log('[GroupChatDialog] Uploading avatar...');
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}/group-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile);

        if (uploadError) {
          console.error('[GroupChatDialog] Avatar upload error:', uploadError);
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;
        console.log('[GroupChatDialog] Avatar uploaded:', avatarUrl);
      }

      // Create group chat with database function
      console.log('[GroupChatDialog] Creating group chat with participants:', {
        creator: user.id,
        members: selectedMembers,
        name: groupName.trim()
      });

      const { data: rpcChatId, error: createError } = await supabase.rpc(
        'create_group_chat_with_participants',
        {
          chat_name: groupName.trim(),
          participant_ids: [user.id, ...selectedMembers.filter(id => id !== user.id)]
        }
      );

      if (createError) {
        console.error('[GroupChatDialog] Group creation error:', createError);
        throw createError;
      }

      const chatId = (Array.isArray(rpcChatId) ? rpcChatId[0] : rpcChatId) as string | null;

      if (!chatId) {
        throw new Error('Failed to create group - no ID returned');
      }

      console.log('[GroupChatDialog] Group created successfully:', chatId);

      // The RPC creates the chat + participants atomically. Only apply the
      // extras (avatar / description) it doesn't handle.
      if (avatarUrl || groupDescription.trim()) {
        const { error: updateError } = await supabase
          .from('chats')
          .update({
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
            ...(groupDescription.trim() ? { description: groupDescription.trim() } : {}),
          })
          .eq('id', chatId);
        if (updateError) {
          console.warn('[GroupChatDialog] Could not save group extras:', updateError);
        }
      }

      console.log('[GroupChatDialog] Group created successfully!');
      toast({ 
        title: 'Group created successfully!',
        description: `${groupName} was created with ${selectedMembers.length} members`
      });
      onGroupCreated(chatId);
      onOpenChange(false);
      
      // Reset form
      setGroupName('');
      setGroupDescription('');
      setSelectedMembers([]);
      setAvatarFile(null);
      setAvatarPreview('');
    } catch (error: any) {
      console.error('[GroupChatDialog] Error creating group:', error);
      toast({
        title: 'Failed to create group',
        description: error.message || 'Please check console for details and try again',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Group Chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avatar upload */}
          <div className="flex flex-col items-center">
            <label htmlFor="group-avatar" className="cursor-pointer">
              <div className="relative h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </label>
            <input
              id="group-avatar"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <p className="text-xs text-muted-foreground mt-2">Add group photo</p>
          </div>

          {/* Group name */}
          <div>
            <Label htmlFor="group-name">Group Name *</Label>
            <Input
              id="group-name"
              placeholder="Enter group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {/* Group description */}
          <div>
            <Label htmlFor="group-desc">Description (optional)</Label>
            <Textarea
              id="group-desc"
              placeholder="What's this group about?"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Member selection */}
          <div>
            <Label>Add Members ({selectedMembers.length} selected)</Label>
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
            />
            <ScrollArea className="h-[200px] border rounded-md p-2">
              {friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No friends yet</p>
                  <p className="text-xs mt-1">Add friends to create group chats</p>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No friends match your search</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleMember(friend.id)}
                    >
                      <Checkbox
                        checked={selectedMembers.includes(friend.id)}
                        onCheckedChange={() => toggleMember(friend.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={friend.avatar_url} />
                        <AvatarFallback>{friend.display_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{friend.display_name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{friend.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <Button
            onClick={handleCreateGroup}
            disabled={creating || !groupName.trim() || selectedMembers.length === 0}
            className="w-full"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
