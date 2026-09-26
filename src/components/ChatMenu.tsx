import { useState } from 'react';
import { MoreVertical, User, Image, BellOff, Download, AlertCircle, Star, Palette, Sparkles, Trash2, Search, Ban, Unlock, UserCircle, Link as LinkIcon, Clock, Video, Phone } from 'lucide-react';
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

interface ChatMenuProps {
  chatId: string;
  otherUserId?: string;
  onExportChat?: () => void;
  onViewMedia?: () => void;
  onReport?: () => void;
  onClearChat?: () => void;
  onBlock?: () => void;
  onSearchInChat?: () => void;
  onViewStarred?: () => void;
  onWallpaperChange?: () => void;
  onViewSharedLinks?: () => void;
  onDisappearingMessages?: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
}

export const ChatMenu = ({ chatId, otherUserId, onExportChat, onViewMedia, onReport, onClearChat, onBlock, onSearchInChat, onViewStarred, onWallpaperChange, onViewSharedLinks, onDisappearingMessages, onVoiceCall, onVideoCall }: ChatMenuProps) => {
  const navigate = useNavigate();
  const { settings, setNickname, muteChat, unmuteChat, togglePin, setTheme } = useChatSettings(chatId, otherUserId);
  const chatMuted = isChatMuted(settings);
  const { isBlocked, unblockUser } = useBlockedUsers();
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [showThemeDialog, setShowThemeDialog] = useState(false);
  const [showLinksDialog, setShowLinksDialog] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
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

  const handleExportChat = async () => {
    try {
      // Fetch all messages for export
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(display_name)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      if (!messages || messages.length === 0) {
        toast({
          title: 'No messages to export',
          description: 'This chat is empty',
        });
        return;
      }

      // Create text export
      const exportText = messages
        .map(msg => {
          const timestamp = new Date(msg.created_at).toLocaleString();
          const sender = msg.sender?.display_name || 'Unknown';
          return `[${timestamp}] ${sender}: ${msg.content || '[Media]'}`;
        })
        .join('\n');

      // Download as text file
      const blob = new Blob([exportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Chat exported',
        description: 'Chat history downloaded successfully',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not export chat',
        variant: 'destructive',
      });
    }
    onExportChat?.();
  };

  const handleAISummary = async () => {
    setSummaryLoading(true);
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('content, media_type, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      if (!messages || messages.length === 0) {
        toast({
          title: 'No messages',
          description: 'This chat has no messages to summarize',
        });
        return;
      }

      const transcript = [...messages].reverse().map((message) => {
        const time = message.created_at ? new Date(message.created_at).toLocaleString() : '';
        const body = message.content?.trim() || `[${message.media_type || 'media'}]`;
        return `[${time}] ${body.slice(0, 1000)}`;
      }).join('\n');
      const { data, error: aiError } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `Summarize this recent chat conversation in concise bullet points. State key topics, decisions, and any clear follow-ups. Do not invent information.\n\n${transcript}`,
          }],
        },
      });
      if (aiError) throw aiError;

      const response = data as {
        choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
        content?: string;
        message?: string;
      } | string | null;
      let generated = '';
      if (typeof response === 'string') {
        generated = response.split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .filter((line) => line && line !== '[DONE]')
          .map((line) => {
            try {
              const chunk = JSON.parse(line) as { choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }> };
              return chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || '';
            } catch {
              return '';
            }
          })
          .join('');
        if (!generated) {
          try {
            const parsed = JSON.parse(response) as { choices?: Array<{ message?: { content?: string } }>; content?: string; message?: string };
            generated = parsed.choices?.[0]?.message?.content || parsed.content || parsed.message || '';
          } catch {
            generated = response.trim();
          }
        }
      } else if (response) {
        generated = response.choices?.[0]?.message?.content
          || response.choices?.[0]?.delta?.content
          || response.content
          || response.message
          || '';
      }
      if (!generated.trim()) throw new Error('The AI returned an empty summary.');
      setSummary(generated.trim());
      setShowSummaryDialog(true);
    } catch (error) {
      console.error('Chat summary error:', error);
      toast({
        title: 'Summary failed',
        description: error instanceof Error ? error.message : 'Could not summarize this chat.',
        variant: 'destructive',
      });
    } finally {
      setSummaryLoading(false);
    }
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
              <DropdownMenuItem onClick={() => navigate(`/profile/${otherUserId}`)} className="rounded-lg py-2.5 px-3 gap-3">
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
          {onDisappearingMessages && (
            <DropdownMenuItem onClick={onDisappearingMessages} className="rounded-lg py-2.5 px-3 gap-3">
              <Clock className="h-4 w-4 text-orange-500" />
              Disappearing Messages
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
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-3 py-1.5">More</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void handleAISummary()} disabled={summaryLoading} className="rounded-lg py-2.5 px-3 gap-3">
            <Sparkles className="h-4 w-4 text-violet-500" />
            {summaryLoading ? 'Creating summary…' : 'AI Summary'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportChat} className="rounded-lg py-2.5 px-3 gap-3">
            <Download className="h-4 w-4 text-muted-foreground" />
            Export Chat
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
      </DropdownMenu>

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

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chat summary</DialogTitle>
            <DialogDescription>Summary of the most recent messages in this conversation.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
            {summary}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};