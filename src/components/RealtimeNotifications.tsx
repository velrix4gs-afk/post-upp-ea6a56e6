import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const alertedNotificationIds = new Set<string>();

export const RealtimeNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch((error) => {
        console.error('[notifications] browser permission request failed', error);
      });
    }

    // Subscribe to notifications
    const channel = supabase
      .channel(`notification-alerts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new;
          if (alertedNotificationIds.has(notification.id)) return;
          alertedNotificationIds.add(notification.id);
          if (alertedNotificationIds.size > 500) {
            const oldestId = alertedNotificationIds.values().next().value;
            if (oldestId) alertedNotificationIds.delete(oldestId);
          }
          
          toast(notification.title, {
            description: notification.content,
          });

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.content,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: notification.id
            });
            if ('vibrate' in navigator) {
              navigator.vibrate([200, 100, 200]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
};
