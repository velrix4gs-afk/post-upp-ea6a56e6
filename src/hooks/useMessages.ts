import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { AsyncStorage, CacheHelper } from '@/lib/asyncStorage';
import { enqueueOfflineAction } from '@/lib/offlineQueue';

// In-memory profile cache to avoid repeated fetches during real-time updates
const profileCache = new Map<string, { username: string; display_name: string; avatar_url?: string; fetchedAt: number }>();
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const loadChatsFromCache = async () => {
    const cached = await CacheHelper.getChats();
    if (cached) {
      setChats(cached);
      setChatsLoading(false);
    }
  };

  const loadMessagesFromCache = async () => {
    if (!chatId) return;
    const cached = await CacheHelper.getMessages(chatId);
    if (cached) {
      setMessages(cached);
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
    if (chatId) {
      // Load from cache first
      loadMessagesFromCache();
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
          
          // Use cached profile for fast real-time updates
          const profile = await getCachedProfile(newMessage.sender_id);
          
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

          // Show notification if message is from another user
          if (newMessage.sender_id !== user?.id) {
            toast({
              title: profile?.display_name || 'New Message',
              description: newMessage.content || 'Sent an attachment',
            });

            // Browser notification for mobile
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(profile?.display_name || 'New Message', {
                body: newMessage.content || 'Sent an attachment',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'post-upp-message'
              });
            }
          }
          
          setMessages(prev => {
            // Check if this exact message ID already exists
            if (prev.some(m => m.id === messageWithProfile.id)) {
              return prev;
            }
            
            // Remove optimistic messages that match this real message
            // Match by: same sender, similar content, within 30 seconds
            const withoutOptimistic = prev.filter(m => {
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
            
            return [...withoutOptimistic, messageWithProfile];
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
    }
  }, [chatId, user]);

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

    try {
      setMessagesLoading(true);
      console.log('[useMessages] Fetching messages for chat:', chatId);
      
      // Fetch messages
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles and reply_to messages
      const messagesWithProfiles: Message[] = await Promise.all(
        (messagesData || []).map(async (msg) => {
          const senderProfile = await getCachedProfile(msg.sender_id);

          let reply_to_message = undefined;
          if (msg.reply_to) {
            const { data: replyMsg } = await supabase
              .from('messages')
              .select('id, content')
              .eq('id', msg.reply_to)
              .maybeSingle();

            if (replyMsg) {
              const replySenderProfile = await getCachedProfile(msg.sender_id);

              reply_to_message = {
                id: replyMsg.id,
                content: replyMsg.content,
                sender: {
                  display_name: replySenderProfile?.display_name || 'User'
                }
              };
            }
          }

          return {
            ...msg,
            status: (msg.status || 'sent') as 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
            sender: {
              username: senderProfile?.username || 'Unknown',
              display_name: senderProfile?.display_name || 'Unknown User',
              avatar_url: senderProfile?.avatar_url
            },
            reply_to_message
          };
        })
      );

      setMessages(messagesWithProfiles);
      
      // Cache messages
      if (chatId) {
        await CacheHelper.saveMessages(chatId, messagesWithProfiles);
      }
      
      console.log('[useMessages] Successfully loaded', messagesWithProfiles.length, 'messages');
    } catch (err: any) {
      console.error('[MSG_001] Failed to load messages:', err);
      toast({
        title: 'Failed to load messages',
        description: err.message || 'Could not load chat messages',
        variant: 'destructive'
      });
    } finally {
      setMessagesLoading(false);
    }
  };

  const sendMessage = async (content: string, replyTo?: string, mediaUrl?: string, mediaType?: string) => {
    if (!chatId || (!content.trim() && !mediaUrl) || !user) return;

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
      return;
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
        return;
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

  const createChat = async (participantUuid: string) => {
    if (!user) return null;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(participantUuid)) {
      console.error('[CHAT] Invalid UUID format:', participantUuid);
      return null;
    }

    try {
      // Check if chat already exists
      const { data: existingChatId } = await supabase
        .rpc('find_private_chat', {
          p_user_a: user.id,
          p_user_b: participantUuid
        });

      if (existingChatId) {
        console.log('[CHAT] Existing chat found:', existingChatId);
        return existingChatId;
      }

      // Create new chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          type: 'private',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (chatError) throw chatError;

      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert([
          { chat_id: newChat.id, user_id: user.id, role: 'member' },
          { chat_id: newChat.id, user_id: participantUuid, role: 'member' }
        ]);

      if (participantsError) throw participantsError;

      console.log('[CHAT] Created successfully:', newChat.id);
      await fetchChats();
      return newChat.id;
    } catch (err: any) {
      console.error('[CHAT] Error:', err);
      return null;
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
    sendMessage,
    editMessage,
    deleteMessage,
    reactToMessage,
    unreactToMessage,
    starMessage,
    unstarMessage,
    forwardMessage,
    markMessageRead,
    createChat,
    refetchChats,
    refetchMessages
  };
};
