import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { VerificationBadge } from '@/components/premium/VerificationBadge';
import { ProfileHoverCard } from '@/components/ProfileHoverCard';
import { useNavigate } from 'react-router-dom';
import { profilePathFor } from '@/lib/profilePath';

interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  is_verified?: boolean;
}

interface FollowersDialogProps {
  open: boolean;
  onClose: () => void;
  users: User[];
  title: string;
}

export const FollowersDialog = ({ open, onClose, users, title }: FollowersDialogProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 p-2">
            {users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No {title.toLowerCase()} yet</p>
              </div>
            ) : (
              users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/70 transition-colors">
                  <ProfileHoverCard userId={user.id}>
                    <Avatar className="h-12 w-12 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate(profilePathFor(user))}>
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>{user.display_name[0]}</AvatarFallback>
                    </Avatar>
                  </ProfileHoverCard>
                  <div className="flex-1 min-w-0">
                    <ProfileHoverCard userId={user.id}>
                      <div className="flex items-center gap-1 cursor-pointer hover:underline">
                        <p className="font-medium truncate">{user.display_name}</p>
                        {user.is_verified && <VerificationBadge />}
                      </div>
                    </ProfileHoverCard>
                    <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(profilePathFor(user))}>View</Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
