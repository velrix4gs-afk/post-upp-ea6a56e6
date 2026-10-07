import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreHorizontal, Share2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/clipboard';

interface ProfileHeaderProps {
  displayName: string;
  username: string;
  postsCount: number;
  isOwnProfile?: boolean;
}

export const ProfileHeader = ({ 
  displayName, 
  username, 
  postsCount,
  isOwnProfile 
}: ProfileHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/feed');
    }
  };

  const handleShare = async () => {
    const profileUrl = `${window.location.origin}/profile/${username}`;
    // The URL is repeated inside `text` on purpose. Several share targets
    // (notably Android Chrome and some WebViews) ignore the separate `url`
    // field and share only `text`, so the recipient received "Check out X's
    // profile" with no link at all.
    const shareText = `Check out ${displayName}'s profile on Post Up! ${profileUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${displayName}'s Profile`,
          text: shareText,
          url: profileUrl,
        });
        return;
      } catch (error) {
        // AbortError is the user dismissing the sheet: not a failure, and not
        // something to fall back from.
        if ((error as DOMException)?.name === 'AbortError') return;
        // Any other failure falls through to copying instead of doing nothing.
      }
    }

    const copied = await copyToClipboard(profileUrl);
    toast(
      copied
        ? { title: 'Link copied!', description: profileUrl }
        : {
            title: 'Could not copy the link',
            description: profileUrl,
            variant: 'destructive',
          },
    );
  };

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="container mx-auto px-3 py-2 flex items-center gap-3 max-w-4xl">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="h-9 w-9 rounded-full hover:bg-muted"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate leading-tight">{displayName}</h1>
          <p className="text-xs text-muted-foreground">
            {postsCount.toLocaleString()} {postsCount === 1 ? 'post' : 'posts'}
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="h-9 w-9 rounded-full hover:bg-muted"
            aria-label="Share profile"
          >
            <Share2 className="h-5 w-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full hover:bg-muted"
                aria-label="More options"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleShare}>
                Share profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`@${username}`)}>
                Copy username
              </DropdownMenuItem>
              {!isOwnProfile && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    Block @{username}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    Report @{username}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
