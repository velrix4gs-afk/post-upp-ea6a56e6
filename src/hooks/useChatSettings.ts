import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { AsyncStorage } from '@/lib/asyncStorage';

// Sync read of persisted wallpaper so the chat background renders instantly
// on open (matches the offline-first / device-cache project rule).
const WALLPAPER_CACHE_PREFIX = 'chat_wallpaper:';
const readCachedWallpaper = (chatId?: string): string | undefined => {
  if (!chatId) return undefined;
  try {
    const raw = localStorage.getItem(`postup_${WALLPAPER_CACHE_PREFIX}${chatId}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return parsed?.url || undefined;
  } catch {
    return undefined;
  }
};
const writeCachedWallpaper = (chatId: string, url?: string) => {
  try {
    AsyncStorage.setItem(
      `${WALLPAPER_CACHE_PREFIX}${chatId}`,
      JSON.stringify({ url: url || '', updated_at: Date.now() })
    );
  } catch {
    /* noop */
  }
};

export interface ChatSettings {
  chat_id: string;
  user_id: string;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived?: boolean;
  muted_until?: string | null;
  wallpaper_url?: string;
  theme_color?: string;
  nickname?: string;
  auto_delete_duration?: number;
  notifications_enabled: boolean;
}

export const isChatMuted = (settings?: Pick<ChatSettings, 'is_muted' | 'muted_until'> | null) => (
  Boolean(settings?.is_muted && (!settings.muted_until || new Date(settings.muted_until).getTime() > Date.now()))
);

export const useChatSettings = (chatId?: string, targetUserId?: string) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ChatSettings | null>(() => {
    const cachedWallpaper = readCachedWallpaper(chatId);
    if (!cachedWallpaper || !chatId) return null;
    return {
      chat_id: chatId,
      user_id: '',
      is_muted: false,
      is_pinned: false,
      notifications_enabled: true,
      wallpaper_url: cachedWallpaper,
    };
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId) return;
    // useState's initializer only runs once on mount, so switching between
    // chats with different wallpapers kept showing the PREVIOUS chat's
    // settings/wallpaper until the network fetch below resolved. This
    // re-applies the new chat's cached wallpaper instantly on switch,
    // before the fetch even starts.
    const cachedWallpaper = readCachedWallpaper(chatId);
    setLoading(true);
    setSettings((prev) =>
      prev?.chat_id === chatId
        ? { ...prev, nickname: undefined }
        : {
          chat_id: chatId,
          user_id: user?.id || '',
          is_muted: false,
          is_pinned: false,
          notifications_enabled: true,
          wallpaper_url: cachedWallpaper,
        }
    );
  }, [chatId, targetUserId, user]);

  const fetchSettings = useCallback(async () => {
    if (!user || !chatId) return;

    try {
      const { data, error } = await supabase
        .from('chat_settings')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      let loadedSettings = data;
      if (!loadedSettings) {
        // Create default settings
        const { data: newSettings, error: createError } = await supabase
          .from('chat_settings')
          .insert({
            chat_id: chatId,
            user_id: user.id,
            is_muted: false,
            is_pinned: false,
            notifications_enabled: true,
          })
          .select()
          .single();

        if (createError) throw createError;
        loadedSettings = newSettings;
      }
      if (!loadedSettings) return;

      let nickname: string | undefined;
      if (targetUserId) {
        const { data: nicknameRow, error: nicknameError } = await supabase
          .from('chat_nicknames')
          .select('nickname')
          .eq('chat_id', chatId)
          .eq('user_id', user.id)
          .eq('target_user_id', targetUserId)
          .maybeSingle();
        if (nicknameError) throw nicknameError;
        nickname = nicknameRow?.nickname;
      }
      setSettings({ ...loadedSettings, nickname });
      writeCachedWallpaper(chatId, loadedSettings.wallpaper_url);
    } catch (error) {
      console.error('Error fetching chat settings:', error);
    } finally {
      setLoading(false);
    }
  }, [chatId, targetUserId, user]);

  useEffect(() => {
    if (user && chatId) void fetchSettings();
  }, [chatId, fetchSettings, user]);

  const updateSettings = async (updates: Partial<ChatSettings>) => {
    if (!user || !chatId) return;

    try {
      const { data, error } = await supabase
        .from('chat_settings')
        .upsert({
          chat_id: chatId,
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'chat_id,user_id' })
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      if (chatId && 'wallpaper_url' in updates) {
        writeCachedWallpaper(chatId, data?.wallpaper_url);
      }
      toast({ title: 'Settings updated' });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({ title: 'Failed to update settings', variant: 'destructive' });
    }
  };

  const toggleMute = () => updateSettings({ is_muted: !settings?.is_muted });
  const togglePin = () => updateSettings({ is_pinned: !settings?.is_pinned });
  // Archive previously didn't exist at all -- the swipe action just showed
  // a "coming soon" toast with no real backend behind it.
  const toggleArchive = () => updateSettings({ is_archived: !settings?.is_archived });
  const setWallpaper = (url: string) => updateSettings({ wallpaper_url: url });
  const setTheme = (color: string) => updateSettings({ theme_color: color });
  const setAutoDelete = (duration?: number) => updateSettings({ auto_delete_duration: duration });

  const muteChat = async (duration?: number) => {
    const muted_until = duration
      ? new Date(Date.now() + duration * 60 * 1000).toISOString()
      : null;
    await updateSettings({ is_muted: true, muted_until });
  };

  const unmuteChat = async () => {
    await updateSettings({ is_muted: false, muted_until: null });
  };

  const setNickname = async (nickname: string, targetId?: string) => {
    if (!user || !chatId || !targetId) {
      toast({ title: 'Could not set nickname', description: 'Choose a person in this chat first.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('chat_nicknames').upsert({
        chat_id: chatId,
        user_id: user.id,
        target_user_id: targetId,
        nickname,
      }, { onConflict: 'chat_id,user_id,target_user_id' });
      if (error) throw error;
      setSettings((prev) => prev ? { ...prev, nickname } : prev);
      toast({ description: 'Nickname set' });
    } catch (error) {
      console.error('Error setting chat nickname:', error);
      toast({ title: 'Failed to set nickname', variant: 'destructive' });
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    toggleMute,
    togglePin,
    toggleArchive,
    setWallpaper,
    setTheme,
    setAutoDelete,
    muteChat,
    unmuteChat,
    setNickname,
    refetch: fetchSettings,
  };
};