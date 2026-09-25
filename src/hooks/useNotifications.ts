import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CacheHelper } from '@/lib/asyncStorage';

export interface Notification {
  id: string;
  user_id: string;
  type: 'friend_request' | 'message' | 'like' | 'comment' | 'mention' | 'share' | 'follow' | 'voice_call' | 'video_call';
  title: string;
  content?: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const liveNotificationsRef = useRef(new Map<string, Notification>());
  const activeUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    setUnreadCount(notifications.filter((notification) => !notification.is_read).length);
  }, [notifications]);

  useEffect(() => {
    if (activeUserIdRef.current !== (user?.id || null)) {
      activeUserIdRef.current = user?.id || null;
      liveNotificationsRef.current.clear();
      setNotifications([]);
      setUnreadCount(0);
      setLoading(Boolean(user));
    }
    if (user) {
      // Load cached notifications first for instant display
      CacheHelper.getNotifications(user.id).then(cached => {
        if (cached && cached.length > 0) {
          setNotifications((current) => {
            const byId = new Map(cached.map((notification: Notification) => [notification.id, notification]));
            current.forEach((notification) => byId.set(notification.id, notification));
            liveNotificationsRef.current.forEach((notification, id) => byId.set(id, notification));
            return [...byId.values()]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 50);
          });
          setLoading(false);
        }
      });

      fetchNotifications();
      
      // Set up real-time subscription for new notifications
      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          const newNotification = payload.new as Notification;
          liveNotificationsRef.current.set(newNotification.id, newNotification);
          setNotifications(prev => {
            if (prev.some((notification) => notification.id === newNotification.id)) return prev;
            const updated = [newNotification, ...prev].slice(0, 50);
            void CacheHelper.saveNotifications(user.id, updated);
            return updated;
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          const updated = payload.new as Notification;
          liveNotificationsRef.current.set(updated.id, updated);
          setNotifications(prev => {
            const newList = prev.map(n => n.id === updated.id ? updated : n);
            void CacheHelper.saveNotifications(user.id, newList);
            return newList;
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const notifs = (data || []) as Notification[];
      setNotifications((current) => {
        const byId = new Map(notifs.map((notification) => [notification.id, notification]));
        current.forEach((notification) => {
          if (!byId.has(notification.id)) byId.set(notification.id, notification);
        });
        liveNotificationsRef.current.forEach((notification, id) => byId.set(id, notification));
        const merged = [...byId.values()]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 50);
        void CacheHelper.saveNotifications(user.id, merged);
        return merged;
      });
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => {
        const updated = prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
        void CacheHelper.saveNotifications(user.id, updated);
        return updated;
      });
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => {
        const updated = prev.map(n => ({ ...n, is_read: true }));
        void CacheHelper.saveNotifications(user.id, updated);
        return updated;
      });
    } catch {
      toast.error('Failed to mark all notifications as read');
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
};
