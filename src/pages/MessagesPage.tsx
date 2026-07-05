import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { usePresence } from '@/hooks/usePresence';
import { useLastSeen } from '@/hooks/useLastSeen';
import { useChatSettings } from '@/hooks/useChatSettings';
import { useAdmin } from '@/hooks/useAdmin';
import Navigation from '@/components/Navigation';
import { VideoCall } from '@/components/VideoCall';
import { VoiceCall } from '@/components/VoiceCall';
import { ChatSettingsDialog } from '@/components/messaging/ChatSettingsDialog';
import { EnhancedMessageBubble } from '@/components/EnhancedMessageBubble';
import VoiceRecorder from '@/components/VoiceRecorder';
import { NewChatDialog } from '@/components/NewChatDialog';
import { GroupChatDialog } from '@/components/messaging/GroupChatDialog';
import { StarredMessagesDialog } from '@/components/messaging/StarredMessagesDialog';
import { ForwardMessageDialog } from '@/components/messaging/ForwardMessageDialog';
import { SearchInChatDialog } from '@/components/messaging/SearchInChatDialog';
import { ChatMediaTab } from '@/components/messaging/ChatMediaTab';
import { GroupInfoDialog } from '@/components/messaging/GroupInfoDialog';
import { WallpaperDialog } from '@/components/messaging/WallpaperDialog';
import { ClearChatDialog } from '@/components/messaging/ClearChatDialog';
import { BlockUserDialog } from '@/components/messaging/BlockUserDialog';
import { ReportUserDialog } from '@/components/messaging/ReportUserDialog';
import { AIAssistantChat } from '@/components/AIAssistantChat';
import { LocationShareDialog } from '@/components/messaging/LocationShareDialog';
import { ContactShareDialog } from '@/components/messaging/ContactShareDialog';
import { ChatMenu } from '@/components/ChatMenu';
import { DisappearingMessagesDialog } from '@/components/messaging/DisappearingMessagesDialog';
import { ChatAttachmentsSheet } from '@/components/messaging/ChatAttachmentsSheet';
import { ScheduleMessageDialog } from '@/components/messaging/ScheduleMessageDialog';
import { ChatListItem } from '@/components/messaging/ChatListItem';
import { ChatHeader } from '@/components/messaging/ChatHeader';
import { ChatInput } from '@/components/messaging/ChatInput';
import { DateSeparator } from '@/components/messaging/DateSeparator';
import { ScrollToBottomFab } from '@/components/messaging/ScrollToBottomFab';
import { PinnedMessageBanner } from '@/components/messaging/PinnedMessageBanner';
import TypingIndicator from '@/components/TypingIndicator';
import { ChatPreviewModal } from '@/components/messaging/ChatPreviewModal';
import { ChatLongPressPopup } from '@/components/messaging/ChatLongPressPopup';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search, Plus, MessageCircle, Sparkles, ArrowLeft, X, Users as UsersIcon, Reply,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

type FilterTab = 'all' | 'unread' | 'favorites' | 'groups';

// Preset wallpaper id → Tailwind class. Anything else is treated as an image URL.
const WALLPAPER_PRESETS: Record<string, string> = {
  default: '',
  blue: 'bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-950 dark:to-blue-900',
  green: 'bg-gradient-to-br from-green-100 to-green-200 dark:from-green-950 dark:to-green-900',
  purple: 'bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-950 dark:to-purple-900',
  pink: 'bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-950 dark:to-pink-900',
  orange: 'bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-950 dark:to-orange-900',
};
const isWallpaperUrl = (v?: string) => !!v && /^(https?:|\/|data:)/i.test(v);

const MessagesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const {
    chats, messages, chatsLoading, messagesLoading, messagesInitialLoaded, sendMessage, editMessage, deleteMessage,
    reactToMessage, unreactToMessage, starMessage, unstarMessage, forwardMessage,
    createChat: createChatByUuid, refetchChats, refetchMessages,
  } = useMessages(selectedChatId || undefined);
  const { handleTyping } = useTypingIndicator(selectedChatId || undefined);
  const { isUserOnline } = usePresence(selectedChatId || undefined);
  const selectedChat = chats.find((c) => c.id === selectedChatId);
  const otherParticipant = selectedChat?.participants.find((p) => p.user_id !== user?.id);
  const { formatLastSeen, isOnline } = useLastSeen(otherParticipant?.user_id);
  const { settings: chatSettings } = useChatSettings(selectedChatId || undefined);

  // Input/state
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);

  // Dialogs
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showGroupChatDialog, setShowGroupChatDialog] = useState(false);
  const [showStarredDialog, setShowStarredDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showMediaTab, setShowMediaTab] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [showClearChat, setShowClearChat] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showDisappearingDialog, setShowDisappearingDialog] = useState(false);
  const [showAttachmentsSheet, setShowAttachmentsSheet] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  // Calls
  const [activeCall, setActiveCall] = useState<'voice' | 'video' | null>(null);
  const [isCallInitiator, setIsCallInitiator] = useState(false);

  // Refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceSendInFlightRef = useRef(false);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const newMessageIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [pinnedChatIds, setPinnedChatIds] = useState<string[]>([]);

  // Long-press preview + delete confirm
  const [previewChatId, setPreviewChatId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Track new messages for animation
  useEffect(() => {
    if (!messages || messages.length === 0) {
      prevMessageIdsRef.current = new Set();
      newMessageIdsRef.current = new Set();
      return;
    }
    const currentIds = new Set(messages.map((m) => m.id));
    if (prevMessageIdsRef.current.size > 0) {
      const freshIds = new Set<string>();
      currentIds.forEach((id) => {
        if (!prevMessageIdsRef.current.has(id)) freshIds.add(id);
      });
      newMessageIdsRef.current = freshIds;
      if (freshIds.size > 0) {
        const t = setTimeout(() => {
          newMessageIdsRef.current = new Set();
        }, 400);
        return () => clearTimeout(t);
      }
    }
    prevMessageIdsRef.current = currentIds;
  }, [messages]);

  // Initial fetch & notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Handle chat_id from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatIdFromUrl = params.get('chat');
    if (chatIdFromUrl) setSelectedChatId(chatIdFromUrl);
  }, []);

  // Auto-scroll behavior
  useEffect(() => {
    if (!messages.length) return;
    if (isInitialLoadRef.current && messagesInitialLoaded) {
      isInitialLoadRef.current = false;
      const container = messagesContainerRef.current;
      if (container) {
        // Always land on the LATEST message when opening a chat.
        // Jumping to first-unread was confusing users — they expect the
        // newest text to be visible, not to be dropped mid-history.
        container.scrollTop = container.scrollHeight;
        // Belt-and-braces: also scroll the sentinel into view after paint.
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        });
      }
    } else {
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [messages, user?.id, messagesInitialLoaded]);

  useEffect(() => {
    isInitialLoadRef.current = true;
    setPinnedMessageId(null);
  }, [selectedChatId]);

  // Track scroll for scroll-to-bottom FAB
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollFab(distFromBottom > 300);
    };
    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, [selectedChatId]);

  // Pinned chats
  useEffect(() => {
    if (!user) return;
    const fetchPinned = async () => {
      const { data } = await supabase
        .from('chat_settings')
        .select('chat_id')
        .eq('user_id', user.id)
        .eq('is_pinned', true);
      if (data) setPinnedChatIds(data.map((d) => d.chat_id));
    };
    fetchPinned();
  }, [user, selectedChatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Hard-delete the current user from a chat (removes it from their list).
  const deleteChat = async (chatId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', user.id);
      if (error) throw error;
      if (selectedChatId === chatId) setSelectedChatId(null);
      await refetchChats();
      toast({ title: 'Chat deleted' });
    } catch (err: any) {
      console.error('[CHAT] Delete failed:', err);
      toast({
        title: 'Failed to delete chat',
        description: err?.message || 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `${file.type.startsWith('video/') ? 'Videos' : 'Images'} must be less than ${maxSize / (1024 * 1024)}MB`,
        variant: 'destructive',
      });
      return;
    }
    setSelectedImage(file);
    setIsVideo(file.type.startsWith('video/'));
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !selectedImage) || !selectedChatId) return;
    const currentText = messageText;
    const currentImage = selectedImage;
    const currentIsVideo = isVideo;
    const currentReplyingTo = replyingTo;
    const currentEditingId = editingMessageId;

    setMessageText('');
    setSelectedImage(null);
    setImagePreview(null);
    setIsVideo(false);
    setReplyingTo(null);
    setEditingMessageId(null);

    try {
      if (currentEditingId) {
        await editMessage(currentEditingId, currentText);
        return;
      }
      let mediaUrl = null;
      let mediaType = null;
      if (currentImage) {
        const fileExt = currentImage.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('messages').upload(fileName, currentImage);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('messages').getPublicUrl(fileName);
        mediaUrl = publicUrl;
        mediaType = currentIsVideo ? `video/${fileExt}` : `image/${fileExt}`;
      }
      await sendMessage(
        currentText.trim() || (currentIsVideo ? '🎥 Video' : '📷 Photo'),
        currentReplyingTo?.id,
        mediaUrl || undefined,
        mediaType || undefined
      );
    } catch {
      setMessageText(currentText);
      if (currentImage) {
        setSelectedImage(currentImage);
        setIsVideo(currentIsVideo);
      }
      if (currentReplyingTo) setReplyingTo(currentReplyingTo);
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    }
  };

  const handleEditMessage = (id: string, content: string) => {
    setEditingMessageId(id);
    setMessageText(content);
  };

  const handleVoiceSend = async (audioBlob: Blob) => {
    if (!selectedChatId || !user || voiceSendInFlightRef.current) return;

    voiceSendInFlightRef.current = true;
    setIsSendingVoice(true);

    try {
      const isMp4Audio = audioBlob.type.includes('mp4');
      const fileName = `${user.id}/${selectedChatId}/${crypto.randomUUID()}.${isMp4Audio ? 'm4a' : 'webm'}`;
      const uploadContentType = isMp4Audio ? 'video/mp4' : 'video/webm';
      const { error: uploadError } = await supabase.storage.from('messages').upload(fileName, audioBlob, {
        contentType: uploadContentType,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('messages').getPublicUrl(fileName);
      const sent = await sendMessage('🎤 Voice message', undefined, publicUrl, isMp4Audio ? 'audio/mp4' : 'audio/webm');
      if (!sent) throw new Error('Voice message insert failed');
      setIsRecordingVoice(false);
    } catch (error) {
      console.error('[MessagesPage] Failed to send voice message:', error);
      // Keep the recorder open so the user can retry. Toast only on real, actionable failures.
      toast({ title: 'Could not send', description: 'Tap send again to retry.', variant: 'destructive' });
    } finally {
      voiceSendInFlightRef.current = false;
      setIsSendingVoice(false);
    }
  };

  const handleForwardMessage = async (chatIds: string[]) => {
    if (forwardingMessageId) {
      await forwardMessage(forwardingMessageId, chatIds);
      setForwardingMessageId(null);
    }
  };

  const handleCreateNewChat = async (friendId: string) => {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(friendId)) throw new Error('CHAT_002: Invalid user ID format');
      const chatId = await createChatByUuid(friendId);
      if (chatId) {
        setSelectedChatId(chatId);
        setSearchQuery('');
        setShowNewChatDialog(false);
        await refetchChats();
      } else {
        throw new Error('CHAT_005: An Error occured try Again');
      }
    } catch (error: any) {
      console.error('[MessagesPage] Create new chat error:', error);
      throw error;
    }
  };

  // Filter + sort chats
  const filteredChats = useMemo(() => {
    return chats
      .filter((chat) => {
        const otherP = chat.participants.find((p) => p.user_id !== user?.id);
        const name = chat.name || otherP?.profiles.display_name || '';
        const matchSearch =
          !searchQuery ||
          name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          chat.participants.some((p) =>
            p.profiles.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        if (!matchSearch) return false;
        if (filterTab === 'unread') return (chat.unread_count || 0) > 0;
        if (filterTab === 'groups') return chat.is_group;
        if (filterTab === 'favorites') return pinnedChatIds.includes(chat.id);
        return true;
      })
      .sort((a, b) => {
        const aPinned = pinnedChatIds.includes(a.id);
        const bPinned = pinnedChatIds.includes(b.id);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        const aT = new Date(a.last_message_at || a.updated_at || 0).getTime();
        const bT = new Date(b.last_message_at || b.updated_at || 0).getTime();
        return bT - aT;
      });
  }, [chats, searchQuery, filterTab, pinnedChatIds, user?.id]);

  // Filtered messages by content for in-chat search
  const filteredMessages =
    selectedChatId && searchQuery.trim()
      ? messages.filter((msg) => msg.content?.toLowerCase().includes(searchQuery.toLowerCase()))
      : messages;

  // Pinned message data
  const pinnedMessage = pinnedMessageId ? messages.find((m) => m.id === pinnedMessageId) : null;

  // Build message list with date separators & smart grouping
  const renderedMessages = useMemo(() => {
    const items: Array<
      | { type: 'date'; key: string; date: string }
      | { type: 'message'; key: string; message: any; isFirstOfGroup: boolean; isLastOfGroup: boolean }
    > = [];
    let lastDateStr = '';
    for (let i = 0; i < filteredMessages.length; i++) {
      const m = filteredMessages[i];
      const dStr = new Date(m.created_at).toDateString();
      if (dStr !== lastDateStr) {
        items.push({ type: 'date', key: `date-${dStr}`, date: m.created_at });
        lastDateStr = dStr;
      }
      const prev = filteredMessages[i - 1];
      const next = filteredMessages[i + 1];
      const prevSameSender = prev && prev.sender_id === m.sender_id && new Date(m.created_at).toDateString() === new Date(prev.created_at).toDateString();
      const nextSameSender = next && next.sender_id === m.sender_id && new Date(m.created_at).toDateString() === new Date(next.created_at).toDateString();
      items.push({
        type: 'message',
        key: m.id,
        message: m,
        isFirstOfGroup: !prevSameSender,
        isLastOfGroup: !nextSameSender,
      });
    }
    return items;
  }, [filteredMessages]);

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'groups', label: 'Groups' },
  ];

  // ----- LIST VIEW -----
  const renderListView = () => (
    <div className="flex flex-col h-full bg-card animate-fade-up">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/feed'))}
              className="h-9 w-9 md:hidden tap-scale rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Chats</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowGroupChatDialog(true)}
              className="h-9 w-9 rounded-full tap-scale"
              aria-label="New group"
            >
              <UsersIcon className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowNewChatDialog(true)}
              className="h-9 w-9 rounded-full tap-scale"
              aria-label="New chat"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 rounded-full bg-muted/40 border-border/40"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          {filterTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterTab(t.id)}
              className={cn(
                'px-3.5 py-1 rounded-full text-[12.5px] font-medium whitespace-nowrap tap-scale transition-colors',
                filterTab === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-foreground/80 hover:bg-muted'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Assistant pinned card */}
      <div
        onClick={() => {
          window.dispatchEvent(new CustomEvent('chatlist:close-swipes'));
          setShowAIChat(true);
          setSelectedChatId(null);
        }}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 cursor-pointer tap-scale transition-colors',
          showAIChat ? 'bg-primary/10' : 'hover:bg-muted/30'
        )}
      >
        <div className="relative flex-shrink-0">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-gradient-primary">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-card" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] leading-tight">
            {isAdmin ? 'Admin AI Assistant' : 'Post Up AI'}
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">AI</span>
          </p>
          <p className="text-[13px] text-muted-foreground truncate leading-tight">
            {isAdmin ? 'Summarize requests & feedback' : 'Your helpful assistant'}
          </p>
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto smooth-scroll">
        {chatsLoading ? (
          <div className="flex flex-col gap-2 p-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-muted rounded" />
                  <div className="h-2.5 w-2/3 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center py-16 px-6 text-muted-foreground">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No results found</p>
              </>
            ) : (
              <>
                <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="font-semibold mb-2">No conversations yet</p>
                <p className="text-sm mb-4">Start chatting by adding friends first</p>
                <Button onClick={() => navigate('/friends')} className="bg-gradient-primary hover:shadow-glow tap-scale">
                  Find Friends
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="animate-stagger">
            {filteredChats.map((chat) => {
              const otherP = chat.participants.find((p) => p.user_id !== user?.id);
              const name = chat.name || otherP?.profiles.display_name || 'Unknown';
              const avatar = chat.avatar_url || otherP?.profiles.avatar_url;
              const isOnlineUser = otherP ? isUserOnline(otherP.user_id) : false;
              return (
                <ChatListItem
                  key={chat.id}
                  id={chat.id}
                  name={name}
                  avatarUrl={avatar}
                  lastMessage={chat.last_message}
                  lastMessageAt={chat.last_message_at || chat.updated_at}
                  unreadCount={chat.unread_count || 0}
                  isOnline={isOnlineUser}
                  isPinned={pinnedChatIds.includes(chat.id)}
                  isGroup={chat.is_group}
                  isSelected={selectedChatId === chat.id}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('chatlist:close-swipes'));
                    setSelectedChatId(chat.id);
                    setShowAIChat(false);
                  }}
                  onLongPress={() => setPreviewChatId(chat.id)}
                  onArchive={() => toast({ description: 'Archive coming soon' })}
                  onDelete={() => setDeleteTarget({ id: chat.id, name: name })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* FAB - new chat */}
      <button
        onClick={() => setShowNewChatDialog(true)}
        className="md:hidden fixed bottom-24 right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center tap-scale animate-bubble-pop z-30 hover:bg-primary/90"
        aria-label="New chat"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );

  // ----- CHAT VIEW -----
  const renderChatView = () => {
    if (!selectedChat) return null;
    const otherP = selectedChat.participants.find((p) => p.user_id !== user?.id);
    const chatName = selectedChat.name || otherP?.profiles.display_name || 'User';
    const chatAvatar = selectedChat.avatar_url || otherP?.profiles.avatar_url;

    return (
      <div className="flex flex-col h-full bg-card animate-slide-in-right">
        <ChatHeader
          name={chatName}
          avatarUrl={chatAvatar}
          isOnline={isOnline}
          statusText={isOnline ? 'online' : formatLastSeen()}
          isGroup={selectedChat.is_group}
          onBack={() => setSelectedChatId(null)}
          onTitleTap={() => {
            if (selectedChat.is_group) {
              setShowGroupInfo(true);
            } else if (otherP?.user_id) {
              navigate(`/profile/${otherP.user_id}`);
            }
          }}
          onVoiceCall={() => {
            setActiveCall('voice');
            setIsCallInitiator(true);
            toast({ title: 'Starting voice call…', description: `Calling ${otherP?.profiles.display_name || 'participant'}` });
          }}
          onVideoCall={() => {
            setActiveCall('video');
            setIsCallInitiator(true);
            toast({ title: 'Starting video call…', description: `Calling ${otherP?.profiles.display_name || 'participant'}` });
          }}
          menu={
            <ChatMenu
              chatId={selectedChatId}
              otherUserId={otherP?.user_id}
              onViewMedia={() => setShowMediaTab(true)}
              onSearchInChat={() => setShowSearchDialog(true)}
              onViewStarred={() => setShowStarredDialog(true)}
              onWallpaperChange={() => setShowWallpaper(true)}
              onClearChat={() => setShowClearChat(true)}
              onBlock={() => setShowBlockDialog(true)}
              onReport={() => setShowReportDialog(true)}
              onDisappearingMessages={() => setShowDisappearingDialog(true)}
            />
          }
        />

        {/* Pinned message banner */}
        {pinnedMessage && (
          <PinnedMessageBanner
            content={pinnedMessage.content || (pinnedMessage.media_url ? '📎 Attachment' : '')}
            senderName={pinnedMessage.sender?.display_name}
            onTap={() => {
              const el = document.getElementById(`message-${pinnedMessage.id}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onUnpin={() => setPinnedMessageId(null)}
          />
        )}

        {/* Messages area */}
        <div
          ref={messagesContainerRef}
          data-chat-thread
          className={cn(
            'flex-1 min-h-0 overflow-y-auto px-2 py-2 smooth-scroll relative',
            !chatSettings?.wallpaper_url && 'chat-wallpaper',
            chatSettings?.wallpaper_url && !isWallpaperUrl(chatSettings.wallpaper_url) &&
              (WALLPAPER_PRESETS[chatSettings.wallpaper_url] || '')
          )}
          style={
            chatSettings?.wallpaper_url && isWallpaperUrl(chatSettings.wallpaper_url)
              ? {
                  backgroundImage: `url(${chatSettings.wallpaper_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          <div className="max-w-3xl mx-auto">
            {searchQuery.trim() && filteredMessages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">No messages found</p>
              </div>
            ) : messagesLoading && messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Loading messages…</div>
            ) : (
              renderedMessages.map((item) => {
                if (item.type === 'date') {
                  return <DateSeparator key={item.key} date={item.date} />;
                }
                const message = item.message;
                const isOwn = message.sender_id === user?.id;
                const senderProfile = selectedChat.participants.find((p) => p.user_id === message.sender_id)?.profiles;
                const replyToData = message.reply_to
                  ? (() => {
                      const replyMsg = messages.find((m) => m.id === message.reply_to);
                      if (!replyMsg) return undefined;
                      const rsp = selectedChat.participants.find((p) => p.user_id === replyMsg.sender_id)?.profiles;
                      return {
                        id: replyMsg.id,
                        content: replyMsg.content || '',
                        sender_name: rsp?.display_name || 'Unknown',
                        media_url: replyMsg.media_url,
                        media_type: replyMsg.media_type,
                      };
                    })()
                  : undefined;

                return (
                  <div key={item.key} className={cn(item.isLastOfGroup ? 'mb-2' : 'mb-0.5')}>
                    <EnhancedMessageBubble
                      isNew={newMessageIdsRef.current.has(message.id)}
                      id={message.id}
                      content={message.content || ''}
                      sender={{
                        username: senderProfile?.username || '',
                        display_name: senderProfile?.display_name || 'Unknown',
                        avatar_url: senderProfile?.avatar_url,
                      }}
                      timestamp={message.created_at}
                      isOwn={isOwn}
                      mediaUrl={message.media_url}
                      mediaType={message.media_type}
                      isEdited={message.is_edited}
                      status={message.status}
                      isForwarded={message.is_forwarded}
                      bubbleColor={chatSettings?.theme_color}
                      replyTo={replyToData}
                      onEdit={isOwn ? handleEditMessage : undefined}
                      onDelete={(id, deleteFor) => deleteMessage(id, deleteFor)}
                      onReply={() => setReplyingTo({ ...message, sender: senderProfile })}
                      onReact={reactToMessage}
                      onUnreact={unreactToMessage}
                      onStar={starMessage}
                      onUnstar={unstarMessage}
                      onForward={(id) => {
                        setForwardingMessageId(id);
                        setShowForwardDialog(true);
                      }}
                      onScrollToMessage={(msgId) => {
                        const el = document.getElementById(`message-${msgId}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    />
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <ScrollToBottomFab visible={showScrollFab} onClick={scrollToBottom} />
        </div>

        {/* Input section */}
        <div className="bg-card flex-shrink-0 border-t border-border/40">
          {selectedChatId && <TypingIndicator chatId={selectedChatId} />}

          {replyingTo && (
            <div className="px-3 py-2 flex items-center justify-between bg-muted/50 animate-slide-up">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Reply className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
                  <p className="text-[11px] font-semibold text-primary leading-tight">
                    {replyingTo.sender?.display_name || 'Reply'}
                  </p>
                  <p className="text-xs truncate text-muted-foreground leading-tight">
                    {replyingTo.content || (replyingTo.media_url ? '📎 Attachment' : '')}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)} className="h-7 w-7 tap-scale">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {imagePreview && (
            <div className="px-3 py-2 flex items-center gap-3 bg-muted/40 animate-slide-up">
              {isVideo ? (
                <video src={imagePreview} className="h-16 w-24 object-cover rounded-lg" />
              ) : (
                <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-lg" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{isVideo ? '🎥 Video' : '📷 Image'} ready to send</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                  setIsVideo(false);
                }}
                className="h-7 w-7 tap-scale"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {isRecordingVoice ? (
            <VoiceRecorder
              onSend={(audioBlob, duration) => handleVoiceSend(audioBlob)}
              onCancel={() => setIsRecordingVoice(false)}
              isSending={isSendingVoice}
            />
          ) : (
            <>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleImageSelect} />
              <input
                type="file"
                ref={cameraInputRef}
                className="hidden"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
              />
              <ChatInput
                value={messageText}
                onChange={setMessageText}
                onSend={handleSendMessage}
                onTyping={handleTyping}
                onAttachClick={() => setShowAttachmentsSheet(true)}
                onCameraClick={() => cameraInputRef.current?.click()}
                onMicClick={() => setIsRecordingVoice(true)}
                placeholder={editingMessageId ? 'Edit message…' : 'Message'}
                hasMedia={!!selectedImage}
                isEditing={!!editingMessageId}
                onCancelEdit={() => {
                  setEditingMessageId(null);
                  setMessageText('');
                }}
              />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      <Navigation />
      <main className="flex-1 min-h-0 overflow-hidden no-bottom-pad" data-no-bottom-pad="true">
        <div className="h-full flex flex-row overflow-hidden">
          {/* List pane */}
          <div className={cn('w-full md:w-80 lg:w-96 md:border-r border-border/40 flex-shrink-0', (selectedChatId || showAIChat) ? 'hidden md:block' : 'block')}>
            {renderListView()}
          </div>

          {/* Chat pane */}
          <div className={cn('flex-1 min-h-0 overflow-hidden', (selectedChatId || showAIChat) ? 'block' : 'hidden md:block')}>
            {showAIChat ? (
              <AIAssistantChat isAdmin={isAdmin} onBack={() => setShowAIChat(false)} />
            ) : selectedChat ? (
              renderChatView()
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-background">
                <div className="text-center max-w-md px-6 space-y-4 animate-fade-up">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-3xl rounded-full" />
                    <MessageCircle className="h-20 w-20 mx-auto text-primary relative z-10" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">Your Messages</h3>
                  <p className="text-sm">Send private messages to friends and connect with others</p>
                  <Button
                    onClick={() => setShowNewChatDialog(true)}
                    className="bg-gradient-primary hover:shadow-glow tap-scale"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Start New Chat
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <NewChatDialog
        open={showNewChatDialog}
        onClose={() => setShowNewChatDialog(false)}
        onSelectFriend={handleCreateNewChat}
      />

      <GroupChatDialog
        open={showGroupChatDialog}
        onOpenChange={setShowGroupChatDialog}
        onGroupCreated={(chatId) => {
          setSelectedChatId(chatId);
          refetchChats();
        }}
      />

      <StarredMessagesDialog
        open={showStarredDialog}
        onClose={() => setShowStarredDialog(false)}
        chatId={selectedChatId || undefined}
      />

      <ForwardMessageDialog
        open={showForwardDialog}
        onClose={() => {
          setShowForwardDialog(false);
          setForwardingMessageId(null);
        }}
        onForward={handleForwardMessage}
        chats={chats}
        currentChatId={selectedChatId || undefined}
      />

      {showSearchDialog && selectedChatId && (
        <SearchInChatDialog
          chatId={selectedChatId}
          open={showSearchDialog}
          onOpenChange={setShowSearchDialog}
          onMessageSelect={(msgId) => {
            const msgEl = document.getElementById(`message-${msgId}`);
            msgEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setShowSearchDialog(false);
          }}
        />
      )}

      {showMediaTab && selectedChatId && <ChatMediaTab chatId={selectedChatId} />}

      {showGroupInfo && selectedChatId && selectedChat?.is_group && (
        <GroupInfoDialog chatId={selectedChatId} open={showGroupInfo} onOpenChange={setShowGroupInfo} />
      )}

      {showWallpaper && selectedChatId && (
        <WallpaperDialog chatId={selectedChatId} open={showWallpaper} onOpenChange={setShowWallpaper} />
      )}

      {showClearChat && selectedChatId && (
        <ClearChatDialog
          chatId={selectedChatId}
          open={showClearChat}
          onOpenChange={setShowClearChat}
          onCleared={() => {
            refetchMessages();
            setShowClearChat(false);
          }}
        />
      )}

      {showBlockDialog && otherParticipant && (
        <BlockUserDialog
          userId={otherParticipant.user_id}
          userName={otherParticipant.profiles.display_name}
          open={showBlockDialog}
          onOpenChange={setShowBlockDialog}
        />
      )}

      {showReportDialog && otherParticipant && (
        <ReportUserDialog
          userId={otherParticipant.user_id}
          userName={otherParticipant.profiles.username || ''}
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
        />
      )}

      {showLocationDialog && (
        <LocationShareDialog
          open={showLocationDialog}
          onOpenChange={setShowLocationDialog}
          onShare={async (lat, lon, address) => {
            const locationText = `📍 ${address || `${lat}, ${lon}`}`;
            await sendMessage(locationText);
            setShowLocationDialog(false);
          }}
        />
      )}

      {showContactDialog && (
        <ContactShareDialog
          open={showContactDialog}
          onOpenChange={setShowContactDialog}
          onShare={async (contactIds) => {
            const contactText = `👤 Shared ${contactIds.length} contact${contactIds.length > 1 ? 's' : ''}`;
            await sendMessage(contactText);
            setShowContactDialog(false);
          }}
        />
      )}

      {showChatSettings && selectedChatId && (
        <ChatSettingsDialog chatId={selectedChatId} open={showChatSettings} onOpenChange={setShowChatSettings} />
      )}

      {showDisappearingDialog && selectedChatId && (
        <DisappearingMessagesDialog
          chatId={selectedChatId}
          isOpen={showDisappearingDialog}
          onClose={() => setShowDisappearingDialog(false)}
        />
      )}

      {activeCall === 'voice' && selectedChatId && otherParticipant && (
        <VoiceCall
          chatId={selectedChatId}
          isInitiator={isCallInitiator}
          onEndCall={() => {
            setActiveCall(null);
            setIsCallInitiator(false);
          }}
          participantName={otherParticipant.profiles.display_name}
          participantAvatar={otherParticipant.profiles.avatar_url}
        />
      )}

      {activeCall === 'video' && selectedChatId && (
        <VideoCall
          chatId={selectedChatId}
          isInitiator={isCallInitiator}
          onEndCall={() => {
            setActiveCall(null);
            setIsCallInitiator(false);
          }}
        />
      )}

      <ChatAttachmentsSheet
        open={showAttachmentsSheet}
        onOpenChange={setShowAttachmentsSheet}
        onGalleryClick={() => fileInputRef.current?.click()}
        onCameraClick={() => cameraInputRef.current?.click()}
        onGifsClick={() => toast({ title: 'GIFs coming soon!' })}
        onStickersClick={() => toast({ title: 'Stickers coming soon!' })}
        onFilesClick={() => fileInputRef.current?.click()}
        onLocationClick={() => setShowLocationDialog(true)}
        onContactsClick={() => setShowContactDialog(true)}
        onScheduleClick={() => {
          if (messageText.trim()) {
            setShowScheduleDialog(true);
          } else {
            toast({ title: 'Type a message first to schedule', variant: 'destructive' });
          }
        }}
      />

      {showScheduleDialog && selectedChatId && (
        <ScheduleMessageDialog
          chatId={selectedChatId}
          content={messageText}
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          onScheduled={() => {
            setMessageText('');
            setShowScheduleDialog(false);
          }}
        />
      )}

      {/* Long-press chat preview (does not mark as read) */}
      {previewChatId && (() => {
        const c = chats.find((x) => x.id === previewChatId);
        if (!c) return null;
        const otherP = c.participants.find((p) => p.user_id !== user?.id);
        const previewName = c.name || otherP?.profiles.display_name || 'Chat';
        const previewAvatar = c.avatar_url || otherP?.profiles.avatar_url;
        return (
          <ChatLongPressPopup
            open={!!previewChatId}
            onClose={() => setPreviewChatId(null)}
            chatId={previewChatId}
            name={previewName}
            avatarUrl={previewAvatar}
            lastMessage={c.last_message}
            unreadCount={c.unread_count || 0}
            onMarkUnread={() => {
              toast({ description: (c.unread_count || 0) > 0 ? 'Marked as read' : 'Marked as unread' });
            }}
            onDelete={() => setDeleteTarget({ id: previewChatId, name: previewName })}
          />
        );
      })()}

      {/* Swipe-to-delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes "{deleteTarget?.name}" from your conversations. The other participant will still see the chat on their side.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) await deleteChat(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MessagesPage;
