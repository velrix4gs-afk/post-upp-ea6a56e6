import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isChatMuted, useChatSettings } from '@/hooks/useChatSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import {
  UserCircle,
  Pencil,
  Images,
  BellOff,
  Bell,
  Sparkles,
  Trash2,
  Ban,
} from 'lucide-react';

interface ChatSettingsDialogProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Other user id, for navigating to their profile. Optional for group chats. */
  otherUserId?: string;
  isGroup?: boolean;
  onDeleteChat?: () => void;
  onBlockUser?: () => void;
}

type RowProps = {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  premium?: boolean;
  trailing?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
};

const Row = ({ icon, label, danger, premium, trailing, disabled, onClick }: RowProps) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => {
      haptic('light');
      onClick?.();
    }}
    className={cn(
      'w-full h-14 px-5 flex items-center gap-4 text-left text-[15px] transition-colors',
      'hover:bg-muted/60 active:bg-muted disabled:opacity-60 disabled:pointer-events-none',
      danger && 'text-destructive',
      premium && 'relative'
    )}
  >
    <span
      className={cn(
        'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0',
        danger ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground/80',
        premium && 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-500 dark:text-purple-300'
      )}
    >
      {icon}
    </span>
    <span className="flex-1 font-medium">{label}</span>
    {trailing}
  </button>
);

/**
 * Bottom-sheet chat info panel.
 * Trimmed to the essential quick actions; deep settings live on dedicated pages.
 */
export const ChatSettingsDialog = ({
  chatId,
  open,
  onOpenChange,
  otherUserId,
  isGroup,
  onDeleteChat,
  onBlockUser,
}: ChatSettingsDialogProps) => {
  const { settings, toggleMute, setNickname } = useChatSettings(chatId, otherUserId);
  const navigate = useNavigate();
  const isMuted = isChatMuted(settings);
  const [nickname, setNicknameInput] = useState('');
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const close = () => onOpenChange(false);
  const saveNickname = async () => {
    if (!otherUserId || !nickname.trim()) return;
    if (await setNickname(nickname.trim(), otherUserId)) {
      setNicknameInput('');
      setNicknameOpen(false);
    }
  };
  const summarizeChat = async () => {
    setSummaryLoading(true);
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('content, media_type, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      if (!messages?.length) {
        toast({ title: 'No messages', description: 'This chat has no messages to summarize.' });
        return;
      }

      const transcript = [...messages].reverse().map((message) => {
        const time = message.created_at ? new Date(message.created_at).toLocaleString() : '';
        return `[${time}] ${message.content?.trim() || `[${message.media_type || 'media'}]`}`;
      }).join('\n');
      const { data, error: aiError } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `Summarize this recent chat conversation in concise bullet points. State key topics, decisions, and clear follow-ups. Do not invent information.\n\n${transcript}`,
          }],
        },
      });
      if (aiError) throw aiError;
      const response = data as {
        choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
        content?: string;
        message?: string;
      } | string | null;
      const result = typeof response === 'string'
        ? response
        : response?.choices?.[0]?.message?.content
          || response?.choices?.[0]?.delta?.content
          || response?.content
          || response?.message
          || '';
      if (!result.trim()) throw new Error('The AI returned an empty summary.');
      setSummary(result.trim());
      setSummaryOpen(true);
    } catch (error) {
      console.error('Could not summarize chat:', error);
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 rounded-t-3xl border-0 bg-background/95 backdrop-blur-xl max-h-[85dvh]"
      >
        <div className="fb-sheet-in">
          {/* Grab handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="pb-[max(env(safe-area-inset-bottom,0px),16px)]">
            {!isGroup && otherUserId && (
              <Row
                icon={<UserCircle className="h-5 w-5" />}
                label="View Profile"
                onClick={() => {
                  close();
                  navigate(`/profile/${otherUserId}`);
                }}
              />
            )}

            {!isGroup && otherUserId && (
              <Row
                icon={<Pencil className="h-5 w-5" />}
                label="Add Nickname"
                onClick={() => setNicknameOpen(true)}
              />
            )}

            <Row
              icon={<Images className="h-5 w-5" />}
              label="View Shared Media"
              onClick={() => {
                close();
                navigate(`/chat-media?chat=${chatId}`);
              }}
            />

            <Row
              icon={isMuted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
              label={isMuted ? 'Unmute Chat' : 'Mute Chat'}
              onClick={() => toggleMute()}
            />

            <Row
              icon={<Sparkles className="h-5 w-5" />}
              label="AI Summary"
              trailing={
                summaryLoading ? (
                  <span className="text-xs text-muted-foreground">Working…</span>
                ) : undefined
              }
              disabled={summaryLoading}
              onClick={() => void summarizeChat()}
            />

            <div className="h-px bg-border/60 my-1 mx-5" />

            {onDeleteChat && (
              <Row
                icon={<Trash2 className="h-5 w-5" />}
                label="Delete Chat"
                danger
                onClick={() => {
                  close();
                  onDeleteChat();
                }}
              />
            )}

            {!isGroup && onBlockUser && (
              <Row
                icon={<Ban className="h-5 w-5" />}
                label="Block User"
                danger
                onClick={() => {
                  close();
                  onBlockUser();
                }}
              />
            )}
          </div>
        </div>
      </SheetContent>
      <Dialog open={nicknameOpen} onOpenChange={setNicknameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set chat nickname</DialogTitle>
            <DialogDescription>This nickname is only visible to you in this conversation.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={nickname}
            onChange={(event) => setNicknameInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void saveNickname()}
            placeholder="Enter nickname"
            maxLength={40}
          />
          <Button onClick={() => void saveNickname()} disabled={!nickname.trim()}>Save nickname</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chat summary</DialogTitle>
            <DialogDescription>Summary of the most recent messages in this conversation.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
};
