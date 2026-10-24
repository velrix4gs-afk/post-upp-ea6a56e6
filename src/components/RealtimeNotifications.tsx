import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Heart, MessageCircle, UserPlus, Share2, AtSign, Phone, Video, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDeliveryReceipts } from '@/hooks/useDeliveryReceipts';
import { usePresence } from '@/hooks/usePresence';
import { toast } from 'sonner';
import { getNotificationPath } from '@/lib/notificationLink';

const alertedNotificationIds = new Set<string>();

const iconFor = (type: string) => {
  switch (type) {
    case 'like': return { Icon: Heart, tint: 'bg-red-500' };
    case 'comment': return { Icon: MessageCircle, tint: 'bg-blue-500' };
    case 'message': return { Icon: MessageCircle, tint: 'bg-primary' };
    case 'friend_request':
    case 'follow':
    case 'follow_request': return { Icon: UserPlus, tint: 'bg-purple-500' };
    case 'share': return { Icon: Share2, tint: 'bg-orange-500' };
    case 'mention': return { Icon: AtSign, tint: 'bg-yellow-500' };
    case 'voice_call': return { Icon: Phone, tint: 'bg-green-500' };
    case 'video_call': return { Icon: Video, tint: 'bg-green-500' };
    default: return { Icon: Bell, tint: 'bg-muted-foreground' };
  }
};

/** Modern in-app notification banner: icon badge, bold title, one-line body, tap to open. */
const Banner = ({ notification, onOpen, onDismiss }: {
  notification: any; onOpen: () => void; onDismiss: () => void;
}) => {
  const { Icon, tint } = iconFor(notification.type);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className="flex w-[min(92vw,380px)] cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-3 pr-2 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 zoom-in-95 fade-in-0 duration-300 active:scale-[0.98] transition-transform"
    >
      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white ${tint}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{notification.title}</p>
        {notification.content && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{notification.content}</p>
        )}
      </div>
      <span className="text-[11px] text-muted-foreground">now</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export const RealtimeNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  useDeliveryReceipts();
  usePresence(); // keeps the user "online" app-wide, not just inside Messages

  useEffect(() => {
    if (!user) return;
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission().catch((error) => {
        console.error('[notifications] browser permission request failed', error);
      });
    }

    // Subscribe to notifications
    const channel = supabase
      .channel(`notification-alerts:${user.id}:${Math.random().toString(36).slice(2, 10)}`)
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

          if (document.visibilityState === 'visible') {
            // Don't pop a banner for a chat the user is already looking at.
            const here = new URLSearchParams(window.location.search).get('chat');
            if (notification.type === 'message' && here && here === notification.data?.chat_id) return;

            toast.custom(
              (id) => (
                <Banner
                  notification={notification}
                  onDismiss={() => toast.dismiss(id)}
                  onOpen={() => {
                    toast.dismiss(id);
                    void supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
                    const path = getNotificationPath(notification);
                    if (path) navigate(path);
                  }}
                />
              ),
              { duration: 5000, position: 'top-center' },
            );
          } else if ('Notification' in window && Notification.permission === 'granted') {
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
  }, [user, navigate]);

  return null;
};
