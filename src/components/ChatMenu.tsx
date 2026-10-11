import { useState } from 'react';
import { MoreVertical, User, Image, BellOff, AlertCircle, Star, Palette, Trash2, Search, Ban, Unlock, UserCircle, Link as LinkIcon, Video, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isChatMuted, useChatSettings } from '@/hooks/useChatSettings';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { toast } from '@/hooks/use-toast';
import { SharedLinksTab } from './messaging/SharedLinksTab';
import { profilePathFor } from '@/lib/profilePath';


interface ChatMenuProps {
  chatId: string;
  otherUserId?: string;
  onViewMedia?: () => void;
  onReport?: () => void;
  onClearChat?: () => void;
  onBlock?: () => void;
  onSearchInChat?: () => void;
  onViewStarred?: () => void;
  onWallpaperChange?: () => void;
  onViewSharedLinks?: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
}

export const ChatMenu = ({ chatId, otherUserId, onViewMedia, onReport, onClearChat, onBlock, onSearchInChat, onViewStarred, onWallpaperChange, onViewSharedLinks, onVoiceCall, onVideoCall }: ChatMenuProps) => {
  const navigate = useNavigate();
  const { settings, setNickname, muteChat, unmuteChat, togglePin, setTheme } = useChatSettings(chatId, otherUserId);
  const chatMuted = isChatMuted(settings);
  const { isBlocked, unblockUser } = useBlockedUsers();
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showLinksDialog, setShowLinksDialog] = useState(false);
  const [nickname, setNicknameInput] = useState('');
  const [muteDuration, setMuteDuration] = useState<string>('30');

  const handleSetNickname = async () => {
    if (nickname.trim()) {
      if (await setNickname(nickname.trim(), otherUserId)) {
        setShowNicknameDialog(false);
        setNicknameInput('');
      }
    }
  };

  const handleMute = async () => {
    const duration = muteDuration === 'forever' ? undefined : parseInt(muteDuration);
    if (await muteChat(duration)) setShowMuteDialog(false);
  };

  const handleUnmute = async () => {
    await unmuteChat();
  };

  const handleThemeChange = async (color: string) => {
    if (await setTheme(color)) setShowThemeDialog(false);
  };





  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-[70vh] overflow-y-auto p-1.5 shadow-xl" onClick={(e) => e.stopPropagation()}>
          {otherUserId && (
            <>
              <DropdownMenuItem
                onClick={() => navigate(profilePathFor(chatUser || { id: otherUserId }))}
                className="rounded-lg py-2.5 px-3 gap-3"
              >
                <UserCircle className="h-4 w-4 text-primary" />
                View Profile
              </DropdownMenuItem>

              {onVoiceCall && (
                <DropdownMenuItem onClick={onVoiceCall} className="rounded-lg py-2.5 px-3 gap-3">
                  <Phone className="h-4 w-4 text-primary" />
                  Voice Call
                </DropdownMenuItem>
              )}
              {onVideoCall && (
                <DropdownMenuItem onClick={onVideoCall} className="rounded-lg py-2.5 px-3 gap-3">
                  <Video className="h-4 w-4 text-primary" />
                  Video Call
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-3 py-1.5">Chat</DropdownMenuLabel>
          {otherUserId && (
            <DropdownMenuItem onClick={() => setShowNicknameDialog(true)} className="rounded-lg py-2.5 px-3 gap-3">
              <User className="h-4 w-4 text-primary" />
              Add Nickname
            </DropdownMenuItem>
          )}
          {onViewMedia && (
            <DropdownMenuItem onClick={onViewMedia} className="rounded-lg py-2.5 px-3 gap-3">
              <Image className="h-4 w-4 text-sky-500" />
              View Shared Media
            </DropdownMenuItem>
          )}
          {onSearchInChat && (
            <DropdownMenuItem onClick={onSearchInChat} className="rounded-lg py-2.5 px-3 gap-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              Search in Chat
            </DropdownMenuItem>
          )}
          {onViewStarred && (
            <DropdownMenuItem onClick={onViewStarred} className="rounded-lg py-2.5 px-3 gap-3">
              <Star className="h-4 w-4 text-amber-500" />
              Starred Messages
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onViewSharedLinks ? onViewSharedLinks() : setShowLinksDialog(true)} className="rounded-lg py-2.5 px-3 gap-3">
            <LinkIcon className="h-4 w-4 text-sky-500" />
            Shared Links
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-3 py-1.5">Settings</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setShowThemeDialog(true)} className="rounded-lg py-2.5 px-3 gap-3">
            <Palette className="h-4 w-4 text-violet-500" />
            Change Theme
          </DropdownMenuItem>
          {onWallpaperChange && (
            <DropdownMenuItem onClick={onWallpaperChange} className="rounded-lg py-2.5 px-3 gap-3">
              <Image className="h-4 w-4 text-violet-500" />
              Change Wallpaper
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={togglePin} className="rounded-lg py-2.5 px-3 gap-3">
            <Star className={`h-4 w-4 text-amber-500 ${settings?.is_pinned ? 'fill-current' : ''}`} />
            {settings?.is_pinned ? 'Remove from Favorites' : 'Add to Favorites'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => chatMuted ? handleUnmute() : setShowMuteDialog(true)} className="rounded-lg py-2.5 px-3 gap-3">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            {chatMuted ? 'Unmute Chat' : 'Mute Chat'}
          </DropdownMenuItem>



          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-destructive/60 px-3 py-1.5">Danger Zone</DropdownMenuLabel>
          {onClearChat && (
            <DropdownMenuItem onClick={onClearChat} className="rounded-lg py-2.5 px-3 gap-3 text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" />
              Clear Chat
            </DropdownMenuItem>
          )}
          {otherUserId && (
            <>
              {isBlocked(otherUserId) ? (
                <DropdownMenuItem
                  onClick={() => void unblockUser(otherUserId)}
                  className="rounded-lg py-2.5 px-3 gap-3 text-emerald-600 focus:text-emerald-600"
                >
                  <Unlock className="h-4 w-4" />
                  Unblock User
                </DropdownMenuItem>
              ) : (
                onBlock && (
                  <DropdownMenuItem onClick={onBlock} className="rounded-lg py-2.5 px-3 gap-3 text-destructive focus:text-destructive">
                    <Ban className="h-4 w-4" />
                    Block User
                  </DropdownMenuItem>
                )
              )}
              {onReport && (
                <DropdownMenuItem onClick={onReport} className="rounded-lg py-2.5 px-3 gap-3 text-destructive focus:text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Report User
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu >

      <Dialog open={showNicknameDialog} onOpenChange={setShowNicknameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Nickname</DialogTitle>
            <DialogDescription>Choose a custom display name for this chat</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                placeholder="Enter nickname"
                value={nickname}
                onChange={(e) => setNicknameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetNickname()}
              />
            </div>
            <Button onClick={handleSetNickname} className="w-full">
              Save Nickname
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showMuteDialog} onOpenChange={setShowMuteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mute Notifications</DialogTitle>
            <DialogDescription>Choose how long to mute this chat</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="duration">Duration</Label>
              <Select value={muteDuration} onValueChange={setMuteDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                  <SelectItem value="1440">1 day</SelectItem>
                  <SelectItem value="10080">1 week</SelectItem>
                  <SelectItem value="forever">Forever</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleMute} className="w-full">
              Mute Chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showThemeDialog} onOpenChange={setShowThemeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Chat Theme</DialogTitle>
            <DialogDescription>Pick a color for this chat</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-4">
            {['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'].map((color) => (
              <button
                key={color}
                onClick={() => handleThemeChange(color)}
                className="h-16 rounded-lg border-2 hover:scale-105 transition"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLinksDialog} onOpenChange={setShowLinksDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Shared Links</DialogTitle>
            <DialogDescription>All links shared in this conversation</DialogDescription>
          </DialogHeader>
          <SharedLinksTab chatId={chatId} />
        </DialogContent>
      </Dialog>


    </>
  );
};