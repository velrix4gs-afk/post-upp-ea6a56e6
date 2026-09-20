import { ArrowLeft, Phone, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ChatHeaderProps {
  name: string;
  avatarUrl?: string;
  statusText?: string;
  isOnline?: boolean;
  isTyping?: boolean;
  isGroup?: boolean;
  onBack: () => void;
  onTitleTap?: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  menu?: ReactNode;
}

export const ChatHeader = ({
  name,
  avatarUrl,
  statusText,
  isOnline,
  isTyping,
  isGroup,
  onBack,
  onTitleTap,
  onVoiceCall,
  onVideoCall,
  menu,
}: ChatHeaderProps) => {
  return (
    <div data-chat-header className="flex items-center gap-1 px-2 py-2 bg-card border-b border-border/40 sticky top-0 z-20 backdrop-blur-md">
      <Button
        size="icon"
        variant="ghost"
        onClick={onBack}
        className="h-9 w-9 rounded-full tap-scale flex-shrink-0"
        aria-label="Back"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>

      <button
        type="button"
        onClick={onTitleTap}
        className="flex items-center gap-2.5 flex-1 min-w-0 py-1 pr-2 rounded-lg hover:bg-muted/40 transition-colors tap-scale text-left"
      >
        <div className="relative flex-shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-muted text-sm">{name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          {isOnline && !isGroup && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-purple-500 border-2 border-card" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[15px] truncate leading-tight">{name}</p>
          <p
            className={cn(
              'text-[12px] truncate leading-tight',
              isTyping ? 'text-primary font-medium' : 'text-muted-foreground'
            )}
          >
            {isTyping ? 'typing…' : statusText || (isOnline ? 'online' : '')}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {!isGroup && onVoiceCall && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onVoiceCall}
            className="h-9 w-9 rounded-full tap-scale"
            aria-label="Voice call"
          >
            <Phone className="h-4.5 w-4.5" />
          </Button>
        )}
        {!isGroup && onVideoCall && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onVideoCall}
            className="h-9 w-9 rounded-full tap-scale hidden sm:inline-flex"
            aria-label="Video call"
          >
            <Video className="h-4.5 w-4.5" />
          </Button>
        )}
        {menu}
      </div>
    </div>
  );
};