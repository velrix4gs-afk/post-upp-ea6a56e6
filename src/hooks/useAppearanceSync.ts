import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * App-level appearance synchronizer.
 * - Applies cached preferences (font size, layout, accent, theme) immediately on mount.
 * - Once authenticated, loads canonical values from `user_settings` and applies + caches them.
 * - Keeps localStorage as a fast offline fallback so preferences persist across reloads
 *   on every page (Feed, Messages, etc.) — not only after visiting Settings.
 */
export const useAppearanceSync = () => {
  const { user } = useAuth();

  // Apply cached values synchronously on mount
  useEffect(() => {
    const root = document.documentElement;
    const fontSize = localStorage.getItem('app_font_size') || 'medium';
    const layout = localStorage.getItem('app_layout_mode') || 'spacious';
    const accent = localStorage.getItem('app_accent_color') || 'blue';
    root.setAttribute('data-font-size', fontSize);
    root.setAttribute('data-layout', layout);
    root.setAttribute('data-accent', accent);
  }, []);

  // Sync from Supabase user_settings once authenticated
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('font_size, layout_mode, accent_color, theme_preference')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled || !data) return;
        const root = document.documentElement;
        if (data.font_size) {
          root.setAttribute('data-font-size', data.font_size);
          localStorage.setItem('app_font_size', data.font_size);
        }
        if (data.layout_mode) {
          root.setAttribute('data-layout', data.layout_mode);
          localStorage.setItem('app_layout_mode', data.layout_mode);
        }
        if (data.accent_color) {
          root.setAttribute('data-accent', data.accent_color);
          localStorage.setItem('app_accent_color', data.accent_color);
        }
        if (data.theme_preference) {
          // Hand off to the existing theme hook through localStorage so the
          // useTheme effect picks it up on next read.
          const current = localStorage.getItem('theme');
          if (current !== data.theme_preference) {
            localStorage.setItem('theme', data.theme_preference);
            const t = data.theme_preference;
            root.classList.remove('light', 'dark');
            if (t === 'system') {
              root.classList.add(
                window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
              );
            } else if (t === 'light' || t === 'dark') {
              root.classList.add(t);
            }
          }
        }
      } catch (err) {
        // Non-blocking: appearance sync failures should never break the app
        console.warn('[useAppearanceSync] Failed to load user_settings', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
};