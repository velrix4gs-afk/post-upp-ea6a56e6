import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getNotificationPath } from '@/lib/notificationLink';

/**
 * Native push notifications (Android/iOS via Firebase Cloud Messaging).
 * No-ops entirely on web — native-only, same pattern as the device gallery plugin.
 * Registers the device's FCM token against this user in `device_tokens` so the
 * `send-push` edge function (fired by a DB trigger on new `notifications` rows)
 * can deliver to it.
 */
export const usePushNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;
    if (registeredFor.current === user.id) return;

    let cancelled = false;
    let listeners: { remove: () => void }[] = [];

    (async () => {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const perm = await PushNotifications.checkPermissions();
      let granted = perm.receive === 'granted';
      if (!granted && perm.receive !== 'denied') {
        const req = await PushNotifications.requestPermissions();
        granted = req.receive === 'granted';
      }
      if (!granted || cancelled) return;

      const regListener = await PushNotifications.addListener('registration', (token) => {
        void supabase
          .from('device_tokens')
          .upsert(
            { user_id: user.id, token: token.value, platform: Capacitor.getPlatform(), updated_at: new Date().toISOString() },
            { onConflict: 'user_id,token' },
          );
      });
      const errListener = await PushNotifications.addListener('registrationError', (err) => {
        console.error('[push] registration failed', err);
      });
      // Foreground pushes: the in-app banner in RealtimeNotifications already
      // covers this via Realtime, so just let the OS show it when backgrounded.
      const tapListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        // FCM data payloads are flat string maps; send-push flattens {type, notification_id, ...}
        // into it, so re-nest it the way getNotificationPath expects ({ type, data }).
        const raw = (action.notification.data || {}) as Record<string, string>;
        const path = getNotificationPath({ type: raw.type, data: raw });
        if (path) navigate(path);
      });
      listeners = [regListener, errListener, tapListener];

      await PushNotifications.register();
      registeredFor.current = user.id;
    })().catch((err) => console.error('[push] setup failed', err));

    return () => {
      cancelled = true;
      listeners.forEach((l) => l.remove());
    };
  }, [user, navigate]);
};
