import { useState, useEffect } from 'react';
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
  wallpaper_url?: string;
  theme_color?: string;
  nickname?: string;
  auto_delete_duration?: number;
  notifications_enabled: boolean;
}

export const useChatSettings = (chatId?: string) => {
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
    setSettings((prev) =>
      prev?.chat_id === chatId
        ? prev
        : {
          chat_id: chatId,
          user_id: user?.id || '',
          is_muted: false,
          is_pinned: false,
          notifications_enabled: true,
          wallpaper_url: cachedWallpaper,
        }
    );
    if (user) {
      fetchSettings();
    }
  }, [user, chatId]);

  const fetchSettings = async () => {
    if (!user || !chatId) return;

    try {
      const { data, error } = await supabase
        .from('chat_settings')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
        writeCachedWallpaper(chatId, data.wallpaper_url);
      } else {
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
        setSettings(newSettings);
        writeCachedWallpaper(chatId, newSettings?.wallpaper_url);
      }
    } catch (error) {
      console.error('Error fetching chat settings:', error);
    } finally {
      setLoading(false);
    }
  };

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
  const setWallpaper = (url: string) => updateSettings({ wallpaper_url: url });
  const setTheme = (color: string) => updateSettings({ theme_color: color });
  const setAutoDelete = (duration?: number) => updateSettings({ auto_delete_duration: duration });

  const muteChat = async (duration?: number) => {
    const muted_until = duration
      ? new Date(Date.now() + duration * 60 * 1000).toISOString()
      : undefined;
    await updateSettings({ is_muted: true });
  };

  const unmuteChat = async () => {
    await updateSettings({ is_muted: false });
  };

  const setNickname = async (nickname: string) => {
    // Was previously overwriting theme_color with the nickname text --
    // that silently destroyed whatever theme color the chat had set.
    // Nickname now has its own real column.
    await updateSettings({ nickname });
    toast({ description: 'Nickname set' });
  };

  return {
    settings,
    loading,
    updateSettings,
    toggleMute,
    togglePin,
    setWallpaper,
    setTheme,
    setAutoDelete,
    muteChat,
    unmuteChat,
    setNickname,
    refetch: fetchSettings,
  };
};