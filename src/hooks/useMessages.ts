import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { AsyncStorage, CacheHelper } from '@/lib/asyncStorage';
import { enqueueOfflineAction } from '@/lib/offlineQueue';
import { ensurePrivateChat } from '@/lib/chatCreation';

// In-memory profile cache to avoid repeated fetches during real-time updates
const profileCache = new Map<string, { username: string; display_name: string; avatar_url?: string; fetchedAt: number }>();
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const purgeExpiredMessages = async (chatId: string, context: string) => {
  try {
    const { error } = await supabase.rpc('purge_expired_messages', { p_chat_id: chatId });
    if (!error) return;

    console.error(`Could not purge expired messages (${context}):`, error);
    const errorDetails = `${error.message} ${error.details || ''} ${error.hint || ''}`;
    const schemaCacheIssue = /purge_expired_messages|schema cache|PGRST202/i.test(errorDetails);
    toast({
      title: 'Expired messages could not be removed from the server',
      description: schemaCacheIssue
        ? 'The server may be missing the purge_expired_messages migration or need its API schema cache refreshed. Messages will still load.'
        : error.message,
      variant: 'destructive',
    });
  } catch (error) {
    console.error(`Could not call purge_expired_messages (${context}):`, error);
    toast({
      title: 'Expired messages could not be removed from the server',
      description: 'The cleanup request failed. Messages will still load; check your connection and try again.',
      variant: 'destructive',
    });
  }
};

const getCachedProfile = async (userId: string) => {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < PROFILE_CACHE_TTL) {
    return { username: cached.username, display_name: cached.display_name, avatar_url: cached.avatar_url };
  }
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', userId)
    .single();
  if (data) {
    profileCache.set(userId, { ...data, fetchedAt: Date.now() });
  }
  return data;
};

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  expires_at?: string | null;
  reply_to?: string;
  is_edited: boolean;
  is_forwarded?: boolean;
  created_at: string;
  updated_at?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  is_optimistic?: boolean;
  sender: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  reply_to_message?: {
    id: string;
    content?: string;
    sender: {
      display_name: string;
    };
  };
}

export interface Chat {
  id: string;
  name?: string;
  avatar_url?: string;
  is_group: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  participants: {
    user_id: string;
    role: string;
    joined_at: string;
    profiles: {
      username?: string;
      display_name?: string;
      avatar_url?: string;
    };
  }[];
}

export const useMessages = (chatId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const chatIdRef = useRef<string | undefined>(chatId);
  const freshFetchAppliedRef = useRef(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesInitialLoaded, setMessagesInitialLoaded] = useState(false);
  const fetchRequestIdRef = useRef(0);
  const fetchingChatRef = useRef<string | null>(null);
  const realtimeMessagesDuringFetchRef = useRef(new Map<string, Message>());
  const locallySentMessageIdsRef = useRef(new Set<string>());

  const loadChatsFromCache = async () => {
    const cached = await CacheHelper.getChats();
    if (cached) {
      setChats(cached);
      setChatsLoading(false);
    }
  };

  const loadMessagesFromCache = async (forChatId: string) => {
    if (!forChatId) return;
    const cached = await CacheHelper.getMessages(forChatId);
    // Two races this guards against:
    // 1) The cache read (disk/IndexedDB) resolving AFTER the network fetch
    //    already set fresh messages -- without this, opening a chat could
    //    silently replace up-to-date messages with a stale cached copy.
    // 2) The cache read for a chat the user has since navigated away from
    //    landing late and overwriting whatever chat is now open.
    if (cached && chatIdRef.current === forChatId && !freshFetchAppliedRef.current) {
      setMessages(cached.filter((message) =>
        !message.expires_at || new Date(message.expires_at).getTime() > Date.now()
      ));
      // Anchor scroll-to-bottom as soon as the cache renders, not only
      // after the network fetch finishes. Previously this stayed false
      // until fetchMessages() completed, so the chat could render at
      // whatever position the cache naturally landed on, then visibly
      // jump once the network response arrived and finally triggered
      // the scroll -- looking like it "went back" after loading.
      setMessagesInitialLoaded(true);
    }
  };

  useEffect(() => {
    if (user) {
      // Load from cache first
      loadChatsFromCache();
      fetchChats();

      // Set up real-time subscription for chats
      const chatsChannel = supabase
        .channel('chats-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chats'
          },
          () => {
            fetchChats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_participants',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchChats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(chatsChannel);
      };
    }
  }, [user]);

  useEffect(() => {
    chatIdRef.current = chatId;
    if (chatId) {
      freshFetchAppliedRef.current = false;
      // Reset initial-loaded flag for the new chat so the page can re-anchor scroll
      setMessagesInitialLoaded(false);
      // Load from cache first
      loadMessagesFromCache(chatId);
      fetchMessages();

      // Set up real-time subscription for messages
      const channel = supabase
        .channel(`messages:${chatId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        }, async (payload) => {
          const newMessage = payload.new as any;
          if (newMessage.expires_at && new Date(newMessage.expires_at).getTime() <= Date.now()) {
            void purgeExpiredMessages(chatId, 'realtime expired message');
            return;
          }

          // Use cached profile for fast real-time updates
          const profile = await getCachedProfile(newMessage.sender_id);
          if (chatIdRef.current !== chatId) return;
          freshFetchAppliedRef.current = true;

          const messageWithProfile: Message = {
            ...newMessage,
            status: 'sent' as const,
            updated_at: newMessage.created_at,
            sender: {
              username: profile?.username || 'user',
              display_name: profile?.display_name || 'User',
              avatar_url: profile?.avatar_url
            }
          };

          if (fetchingChatRef.current === chatId) {
            realtimeMessagesDuringFetchRef.current.set(messageWithProfile.id, messageWithProfile);
          }
          locallySentMessageIdsRef.current.delete(messageWithProfile.id);

          setMessages(prev => {
            const withoutOptimistic = prev.filter(m => {
              if (m.id === messageWithProfile.id) return false;
              if (!m.is_optimistic) return true;
              if (m.sender_id !== messageWithProfile.sender_id) return true;

              // Check if content matches (or both are media messages)
              const contentMatches = m.content === messageWithProfile.content ||
                (!m.content && !messageWithProfile.content);
              const mediaMatches = m.media_url === messageWithProfile.media_url;
              const timeClose = Math.abs(
                new Date(m.created_at).getTime() - new Date(messageWithProfile.created_at).getTime()
              ) < 30000;

              // Remove if it's the same message
              return !(contentMatches && mediaMatches && timeClose);
            });

            return [...withoutOptimistic, messageWithProfile].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        }, async (payload) => {
          const updatedMessage = payload.new as any;

          // Use cached profile for fast real-time updates
          const profile = await getCachedProfile(updatedMessage.sender_id);

          const messageWithProfile: Message = {
            ...updatedMessage,
            status: (updatedMessage.status || 'sent') as 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
            updated_at: updatedMessage.edited_at || updatedMessage.created_at,
            sender: {
              username: profile?.username || 'user',
              display_name: profile?.display_name || 'User',
              avatar_url: profile?.avatar_url
            }
          };

          setMessages(prev => prev.map(msg =>
            msg.id === messageWithProfile.id ? messageWithProfile : msg
          ));
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        }, (payload) => {
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      fetchRequestIdRef.current += 1;
      fetchingChatRef.current = null;
      setMessages([]);
      setMessagesLoading(false);
      setMessagesInitialLoaded(false);
    }
  }, [chatId, user]);

  useEffect(() => {
    if (!chatId) return;
    const nextExpiry = messages.reduce<number | null>((earliest, message) => {
      if (!message.expires_at) return earliest;
      const expiry = new Date(message.expires_at).getTime();
      if (!Number.isFinite(expiry)) return earliest;
      return earliest === null ? expiry : Math.min(earliest, expiry);
    }, null);
    if (nextExpiry === null) return;

    const timeout = window.setTimeout(async () => {
      setMessages((previous) => previous.filter((message) =>
        !message.expires_at || new Date(message.expires_at).getTime() > Date.now()
      ));
      await purgeExpiredMessages(chatId, 'expiry timer');
    }, Math.max(0, nextExpiry - Date.now()) + 25);

    return () => window.clearTimeout(timeout);
  }, [chatId, messages]);

  const fetchChats = async () => {
    try {
      // Only show the skeleton on the very first load. Background refreshes
      // (realtime, manual refetch) keep the existing list visible to avoid flicker.
      setChats((prev) => {
        if (prev.length === 0) setChatsLoading(true);
        return prev;
      });
      console.log('[useMessages] Fetching chats via get_chat_list RPC');

      // Use the optimized RPC that returns everything in one query
      const { data: chatList, error } = await supabase.rpc('get_chat_list');

      if (error) throw error;

      if (!chatList || chatList.length === 0) {
        setChats([]);
        setChatsLoading(false);
        return;
      }

      // Deduplicate private chats by other_user_id
      const seenUsers = new Map<string, boolean>();
      const dedupedList = (chatList as any[]).filter((chat) => {
        if (chat.type === 'group') return true;
        if (!chat.other_user_id) return true;
        if (seenUsers.has(chat.other_user_id)) return false;
        seenUsers.set(chat.other_user_id, true);
        return true;
      });

      // Map RPC results to the Chat interface shape
      const validChats: Chat[] = dedupedList.map((row: any) => ({
        id: row.chat_id,
        name: row.chat_name || undefined,
        avatar_url: row.other_user_avatar || undefined,
        is_group: row.type === 'group',
        created_at: row.chat_created_at,
        updated_at: row.last_message_at || row.chat_created_at,
        last_message: row.last_message || undefined,
        last_message_at: row.last_message_at || undefined,
        unread_count: row.unread_count || 0,
        participants: row.other_user_id ? [
          {
            user_id: user!.id,
            role: 'member',
            joined_at: row.chat_created_at,
            profiles: {
              username: user!.user_metadata?.username || 'user',
              display_name: user!.user_metadata?.display_name || 'User',
              avatar_url: user!.user_metadata?.avatar_url
            }
          },
          {
            user_id: row.other_user_id,
            role: 'member',
            joined_at: row.chat_created_at,
            profiles: {
              username: row.other_user_name || 'Unknown',
              display_name: row.other_user_name || 'Unknown User',
              avatar_url: row.other_user_avatar || undefined
            }
          }
        ] : [{
          user_id: user!.id,
          role: 'member',
          joined_at: row.chat_created_at,
          profiles: {
            username: user!.user_metadata?.username || 'user',
            display_name: user!.user_metadata?.display_name || 'User',
            avatar_url: user!.user_metadata?.avatar_url
          }
        }]
      }));

      setChats(validChats);

      // Cache chats
      await CacheHelper.saveChats(validChats);

      console.log('[useMessages] Successfully loaded', validChats.length, 'chats');
    } catch (err: any) {
      console.error('[CHAT_001] Failed to load chats:', err);

      if (!navigator.onLine || err?.message?.includes('fetch') || err?.message?.includes('network')) {
        toast({
          title: 'No internet connection',
          description: 'Please check your network and try again',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Failed to load chats',
          description: 'Could not load your conversations',
          variant: 'destructive'
        });
      }
    } finally {
      setChatsLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!chatId) return;
    const fetchingFor = chatId;
    const requestId = ++fetchRequestIdRef.current;

    try {
      fetchingChatRef.current = fetchingFor;
      realtimeMessagesDuringFetchRef.current = new Map();
      setMessagesLoading(true);
      console.log('[useMessages] Fetching messages for chat:', fetchingFor);

      await purgeExpiredMessages(fetchingFor, 'chat opening');

      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', fetchingFor)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (chatIdRef.current !== fetchingFor || requestId !== fetchRequestIdRef.current) return;
      freshFetchAppliedRef.current = true;

      const rows = messagesData || [];
      const fetchedMessageIds = new Set(rows.map((message) => message.id));
      fetchedMessageIds.forEach((id) => locallySentMessageIdsRef.current.delete(id));
      const replyIds = [...new Set(rows.flatMap((message) => message.reply_to ? [message.reply_to] : []))];
      const { data: replyRows, error: replyError } = replyIds.length
        ? await supabase.from('messages').select('id, content, sender_id').in('id', replyIds)
        : { data: [], error: null };
      if (replyError) throw replyError;
      if (chatIdRef.current !== fetchingFor || requestId !== fetchRequestIdRef.current) return;

      const replyById = new Map((replyRows || []).map((message) => [message.id, message]));
      const profileIds = [...new Set([
        ...rows.map((message) => message.sender_id),
        ...(replyRows || []).map((message) => message.sender_id),
      ])];
      const profiles = await Promise.all(profileIds.map(async (id) => [id, await getCachedProfile(id)] as const));
      if (chatIdRef.current !== fetchingFor || requestId !== fetchRequestIdRef.current) return;
      const profileById = new Map(profiles);

      const messagesWithProfiles: Message[] = rows.map((msg) => {
        const senderProfile = profileById.get(msg.sender_id);
        const replyMessage = msg.reply_to ? replyById.get(msg.reply_to) : undefined;
        const replySenderProfile = replyMessage ? profileById.get(replyMessage.sender_id) : undefined;

        return {
          ...msg,
          status: (msg.status || 'sent') as 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
          sender: {
            username: senderProfile?.username || 'Unknown',
            display_name: senderProfile?.display_name || 'Unknown User',
            avatar_url: senderProfile?.avatar_url
          },
          reply_to_message: replyMessage ? {
            id: replyMessage.id,
            content: replyMessage.content,
            sender: { display_name: replySenderProfile?.display_name || 'User' }
          } : undefined
        };
      });

      const sorted = [...messagesWithProfiles].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const realtimeMessages = [...realtimeMessagesDuringFetchRef.current.values()];
      let merged: Message[] = sorted;
      setMessages((current) => {
        const mergedById = new Map(sorted.map((message) => [message.id, message]));
        realtimeMessages.forEach((message) => mergedById.set(message.id, message));
        current
          .filter((message) =>
            message.chat_id === fetchingFor &&
            (message.is_optimistic || locallySentMessageIdsRef.current.has(message.id))
          )
          .forEach((message) => mergedById.set(message.id, message));
        merged = [...mergedById.values()].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return merged;
      });
      freshFetchAppliedRef.current = true;

      await CacheHelper.saveMessages(fetchingFor, merged);

      console.log('[useMessages] Successfully loaded', messagesWithProfiles.length, 'messages');
    } catch (err: any) {
      if (chatIdRef.current !== fetchingFor || requestId !== fetchRequestIdRef.current) return;
      console.error('[MSG_001] Failed to load messages:', err);
      toast({
        title: 'Failed to load messages',
        description: err.message || 'Could not load chat messages',
        variant: 'destructive'
      });
    } finally {
      if (chatIdRef.current === fetchingFor && requestId === fetchRequestIdRef.current) {
        fetchingChatRef.current = null;
        setMessagesLoading(false);
        setMessagesInitialLoaded(true);
      }
    }
  };

  const sendMessage = async (content: string, replyTo?: string, mediaUrl?: string, mediaType?: string): Promise<boolean> => {
    if (!chatId || (!content.trim() && !mediaUrl) || !user) return false;

    // Generate temporary ID for optimistic update
    const tempId = `temp-${crypto.randomUUID()}`;

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content: content.trim() || undefined,
      media_url: mediaUrl,
      media_type: mediaType,
      reply_to: replyTo,
      is_edited: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'sending',
      is_optimistic: true,
      sender: {
        username: user.user_metadata?.username || 'user',
        display_name: user.user_metadata?.display_name || 'User',
        avatar_url: user.user_metadata?.avatar_url,
      },
    };

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage]);

    // Persist status in localStorage
    const messageStatusKey = `msg_status_${tempId}`;

    // If offline, queue the action and mark as queued
    if (!navigator.onLine) {
      localStorage.setItem(messageStatusKey, 'queued');
      setMessages(prev => prev.map(msg =>
        msg.id === tempId ? { ...msg, status: 'sending' as const } : msg
      ));
      enqueueOfflineAction('insert', 'messages', {
        chat_id: chatId,
        sender_id: user.id,
        content: content.trim() || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        reply_to: replyTo || null,
        status: 'sent'
      });
      toast({
        title: 'Queued',
        description: 'Message will be sent when you\'re back online',
        duration: 2000,
      });
      return true;
    }

    localStorage.setItem(messageStatusKey, 'sending');

    try {
      // Insert message into database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          content: content.trim() || null,
          media_url: mediaUrl || null,
          media_type: mediaType || null,
          reply_to: replyTo || null,
          status: 'sent'
        })
        .select()
        .single();

      if (error) throw error;

      // Fetch sender profile
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('id', user.id)
        .single();

      // Update status to sent
      localStorage.setItem(messageStatusKey, 'sent');

      // Replace optimistic message with real message
      const realMessage: Message = {
        ...data,
        status: 'sent' as const,
        updated_at: data.created_at,
        sender: {
          username: senderProfile?.username || 'user',
          display_name: senderProfile?.display_name || 'User',
          avatar_url: senderProfile?.avatar_url
        }
      };

      locallySentMessageIdsRef.current.add(realMessage.id);
      setMessages(prev => prev.map(msg =>
        msg.id === tempId ? realMessage : msg
      ));

      // Update chat's updated_at timestamp
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);

      // Clean up status after 3 seconds
      setTimeout(() => {
        localStorage.removeItem(messageStatusKey);
      }, 3000);
      return true;
    } catch (err: any) {
      console.error('Send message error:', err);

      // If network error, queue it
      if (!navigator.onLine || err?.message?.includes('fetch') || err?.message?.includes('Failed to fetch')) {
        localStorage.setItem(messageStatusKey, 'queued');
        enqueueOfflineAction('insert', 'messages', {
          chat_id: chatId,
          sender_id: user.id,
          content: content.trim() || null,
          media_url: mediaUrl || null,
          media_type: mediaType || null,
          reply_to: replyTo || null,
          status: 'sent'
        });
        toast({
          title: 'Queued',
          description: 'Will send when connection is restored',
          duration: 2000,
        });
        return true;
      }

      // Update status to failed
      localStorage.setItem(messageStatusKey, 'failed');

      // Mark message as failed
      setMessages(prev => prev.map(msg =>
        msg.id === tempId
          ? { ...msg, status: 'failed' as const }
          : msg
      ));

      toast({
        title: 'Error',
        description: err.message || 'Failed to send message',
        variant: 'destructive'
      });

      // Keep failed status for 30 seconds
      setTimeout(() => {
        localStorage.removeItem(messageStatusKey);
      }, 30000);
      return false;
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    if (!content.trim()) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .update({
          content: content.trim(),
          is_edited: true,
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;

      // Fetch sender profile
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url')
        .eq('id', data.sender_id)
        .single();

      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? {
            ...data,
            status: (data.status || 'sent') as 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
            updated_at: data.edited_at || data.created_at,
            sender: {
              username: senderProfile?.username || 'user',
              display_name: senderProfile?.display_name || 'User',
              avatar_url: senderProfile?.avatar_url
            }
          }
          : msg
      ));
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to edit message',
        variant: 'destructive'
      });
    }
  };

  const deleteMessage = async (messageId: string, deleteFor: 'me' | 'everyone' = 'me') => {
    try {
      if (deleteFor === 'everyone') {
        // Completely delete the message from database
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', messageId)
          .eq('sender_id', user!.id); // Only allow sender to delete for everyone

        if (error) throw error;

        // Remove from local state immediately
        setMessages(prev => prev.filter(msg => msg.id !== messageId));

        toast({
          title: 'Success',
          description: 'Message deleted for everyone',
        });
      } else {
        // Delete for me - also hard delete from database
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', messageId);

        if (error) throw error;

        // Remove from local state
        setMessages(prev => prev.filter(msg => msg.id !== messageId));

        toast({
          title: 'Success',
          description: 'Message deleted',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive'
      });
    }
  };

  const reactToMessage = async (messageId: string, reactionType: string) => {
    try {
      // Check if reaction exists
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (existing) {
        // Update existing reaction
        const { error } = await supabase
          .from('message_reactions')
          .update({ reaction_type: reactionType })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new reaction
        const { error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user!.id,
            reaction_type: reactionType
          });

        if (error) throw error;
      }
    } catch (err: any) {
      console.error('React to message error:', err);
    }
  };

  const unreactToMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user!.id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Unreact to message error:', err);
    }
  };

  const starMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('starred_messages')
        .insert({
          user_id: user!.id,
          message_id: messageId
        });

      if (error && error.code === '23505') {
        // Already starred, ignore
        return;
      }

      if (error) throw error;
    } catch (err: any) {
      console.error('Star message error:', err);
    }
  };

  const unstarMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('starred_messages')
        .delete()
        .eq('user_id', user!.id)
        .eq('message_id', messageId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Unstar message error:', err);
    }
  };

  const forwardMessage = async (messageId: string, toChatIds: string[]) => {
    try {
      // Get original message
      const { data: originalMessage, error: fetchError } = await supabase
        .from('messages')
        .select('content, media_url, media_type')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      // Create forwarded messages
      const forwardedMessages = toChatIds.map(chatId => ({
        chat_id: chatId,
        sender_id: user!.id,
        content: originalMessage.content,
        media_url: originalMessage.media_url,
        media_type: originalMessage.media_type,
        is_forwarded: true,
        forwarded_from_message_id: messageId,
        status: 'sent'
      }));

      const { error } = await supabase
        .from('messages')
        .insert(forwardedMessages);

      if (error) throw error;
    } catch (err: any) {
      console.error('Forward message error:', err);
    }
  };

  const markMessageRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('message_reads')
        .insert({
          message_id: messageId,
          user_id: user!.id
        });

      if (error && error.code === '23505') {
        // Already marked as read, ignore
        return;
      }

      if (error) throw error;
    } catch (err: any) {
      console.error('Mark message read error:', err);
    }
  };

  // Marks every message from the other person in this chat as read.
  // This was previously never called anywhere in the app -- messages
  // never transitioned to 'read' at all, which is why the unread badge
  // never cleared and read receipts never showed.
  const markChatAsRead = async (targetChatId: string) => {
    if (!user || !targetChatId) return;
    try {
      const { error } = await supabase.rpc('mark_chat_messages_read', { p_chat_id: targetChatId });
      if (error) throw error;
    } catch (err) {
      console.error('[markChatAsRead] failed:', err);
    }
  };

  const createChat = async (participantUuid: string) => {
    if (!user) return null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(participantUuid)) {
      console.error('[CHAT] Invalid UUID format:', participantUuid);
      return null;
    }

    try {
      const chatId = await ensurePrivateChat(user.id, participantUuid);
      await fetchChats();
      return chatId;
    } catch (err: any) {
      console.error('[CHAT] Error:', err);
      throw err;
    }
  };

  const refetchChats = () => {
    fetchChats();
  };

  const refetchMessages = () => {
    if (chatId) fetchMessages();
  };

  return {
    messages,
    chats,
    chatsLoading,
    messagesLoading,
    messagesInitialLoaded,
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    unreactToMessage,
    starMessage,
    unstarMessage,
    forwardMessage,
    markMessageRead,
    markChatAsRead,
    createChat,
    refetchChats,
    refetchMessages
  };
};