import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserPresence {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  online_at: string;
  viewing_chat?: string;
}

/**
 * One app-wide presence channel (singleton). Previously each caller built its own channel and
 * only the Messages page tracked presence, so people only looked "online" while sitting in Messages.
 * Now the app mounts this once at the root (RealtimeNotifications), so being in the app = being online.
 */
const STALE_MS = 3 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

let channel: RealtimeChannel | null = null;
let channelUserId: string | null = null;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let refCount = 0;
let online: Record<string, UserPresence> = {};
let viewingChat: string | undefined;
let myInfo: { display_name: string; avatar_url?: string } = { display_name: 'User' };
const listeners = new Set<(s: Record<string, UserPresence>) => void>();
const emit = () => listeners.forEach((l) => l(online));

const track = async () => {
  if (!channel || !channelUserId) return;
  try {
    await channel.track({
      user_id: channelUserId,
      display_name: myInfo.display_name,
      avatar_url: myInfo.avatar_url,
      online_at: new Date().toISOString(),
      viewing_chat: viewingChat,
    });
  } catch { /* offline — next heartbeat retries */ }
};

const onVisible = () => { if (document.visibilityState === 'visible') void track(); };

const start = (userId: string) => {
  if (channel && channelUserId === userId) return;
  stop();
  channelUserId = userId;
  const ch = supabase.channel('online-users', { config: { presence: { key: userId } } });
  channel = ch;
  ch.on('presence', { event: 'sync' }, () => {
    const next: Record<string, UserPresence> = {};
    Object.values(ch.presenceState<UserPresence>()).forEach((presences) => {
      presences.forEach((p) => {
        if (Date.now() - new Date(p.online_at).getTime() < STALE_MS) next[p.user_id] = p;
      });
    });
    online = next;
    emit();
  }).subscribe(async (status) => {
    if (status !== 'SUBSCRIBED') return;
    const { data } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', userId).maybeSingle();
    myInfo = { display_name: data?.display_name || 'User', avatar_url: data?.avatar_url || undefined };
    await track();
    clearInterval(heartbeat);
    heartbeat = setInterval(track, HEARTBEAT_MS);
  });
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onVisible);
};

const stop = () => {
  clearInterval(heartbeat);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onVisible);
  if (channel) supabase.removeChannel(channel);
  channel = null;
  channelUserId = null;
  online = {};
  emit();
};

export const usePresence = (chatId?: string) => {
  const { user } = useAuth();
  const userId = user?.id;
  const [onlineUsers, setOnlineUsers] = useState<Record<string, UserPresence>>(online);

  useEffect(() => {
    if (!userId) return;
    refCount++;
    listeners.add(setOnlineUsers);
    setOnlineUsers(online);
    start(userId);
    return () => {
      listeners.delete(setOnlineUsers);
      refCount--;
      if (refCount <= 0) { refCount = 0; stop(); }
    };
  }, [userId]);

  // Which chat is open (used for "viewing" state) without rebuilding the channel.
  useEffect(() => {
    if (!chatId) return;
    viewingChat = chatId;
    void track();
    return () => {
      if (viewingChat === chatId) { viewingChat = undefined; void track(); }
    };
  }, [chatId]);

  const updateViewingChat = async (newChatId?: string) => {
    viewingChat = newChatId;
    await track();
  };

  const isUserOnline = (id: string) => !!onlineUsers[id];
  const isUserViewingChat = (id: string, checkChatId: string) => onlineUsers[id]?.viewing_chat === checkChatId;

  return { onlineUsers, isUserOnline, isUserViewingChat, updateViewingChat };
};
