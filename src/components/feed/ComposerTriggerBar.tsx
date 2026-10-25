import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfile } from '@/hooks/useProfile';

/**
 * Slim entry point for the feed's "what's on your mind" row. Tapping it
 * (anywhere, including the photo icon) opens the full-screen post composer
 * at /create/post instead of expanding inline — replaces the old CreatePost
 * card, which grew the whole feed vertically just to show its toolbar.
 */
export const ComposerTriggerBar = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();

  return (
    <Card className="bg-gradient-card border-0 shadow-sm">
      <button
        type="button"
        onClick={() => navigate('/create/post')}
        className="flex w-full items-center gap-3 p-4 text-left touch-manipulation active:opacity-80"
      >
        <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
          <AvatarImage src={profile?.avatar_url} />
          <AvatarFallback className="bg-gradient-primary text-sm text-white">
            {profile?.display_name?.split(' ').map((n) => n[0]).join('') || 'U'}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate rounded-full bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
          What's on your mind, {profile?.display_name?.split(' ')[0] || 'there'}?
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
          <ImageIcon className="h-4 w-4" />
        </span>
      </button>
    </Card>
  );
};

export default ComposerTriggerBar;
