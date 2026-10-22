import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import {
  Bell, Heart, MessageCircle, UserPlus, Share2, AtSign, CheckCheck, Trash2, Phone, Video,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { NotificationActions } from '@/components/NotificationActions';
import { getNotificationActorId } from '@/lib/notificationLink';
import { getNotificationPath } from '@/lib/notificationLink';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

// Request-type rows keep their Accept/Decline buttons (those are the point of the row).
// Everything else is just "tap to open" — no extra buttons.
const ACTIONABLE_TYPES = new Set(['friend_request', 'follow_request']);

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'like': return <Heart className="h-4 w-4 text-red-500" />;
    case 'comment': return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case 'friend_request': return <UserPlus className="h-4 w-4 text-green-500" />;
    case 'follow':
    case 'follow_request': return <UserPlus className="h-4 w-4 text-purple-500" />;
    case 'share': return <Share2 className="h-4 w-4 text-orange-500" />;
    case 'mention': return <AtSign className="h-4 w-4 text-yellow-500" />;
    case 'message': return <MessageCircle className="h-4 w-4 text-primary" />;
    case 'voice_call': return <Phone className="h-4 w-4 text-primary" />;
    case 'video_call': return <Video className="h-4 w-4 text-primary" />;
    default: return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

const NotificationCenter = ({ isOpen, onClose }: NotificationCenterProps) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, refetch } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const navigate = useNavigate();

  // Tapping a notification takes the user straight to the thing it is about:
  // the chat thread, the post (scrolled to comments for comment notifications), or the profile.
  const openNotification = (notification: any) => {
    if (!notification.is_read) void markAsRead(notification.id);
    const path = getNotificationPath(notification);
    if (path) {
      onClose();
      navigate(path);
    }
  };

  const handleClearAll = async () => {
    setShowClearAllDialog(false);
    await clearAll();
    await refetch();
    toast({ title: 'Notifications cleared' });
  };

  // One row per notification — never bundled into stacks.
  const visible = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  // Actor avatars (who liked / commented / followed / messaged).
  const [actors, setActors] = useState<Record<string, { display_name: string | null; avatar_url: string | null }>>({});
  useEffect(() => {
    const ids = [...new Set(visible.map((n) => getNotificationActorId(n) || n?.data?.sender_id).filter(Boolean) as string[])]
      .filter((id) => !(id in actors));
    if (ids.length === 0) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids.slice(0, 50))
      .then(({ data }) => {
        if (cancelled || !data) return;
        setActors((prev) => {
          const next = { ...prev };
          data.forEach((p: any) => { next[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
          return next;
        });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Section headers (Today / Yesterday / Earlier) — labels only, rows are never merged.
  const rows = useMemo(() => {
    const dayLabel = (iso: string) => {
      const d = new Date(iso);
      const today = new Date();
      const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000);
      return diffDays <= 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : 'Earlier';
    };
    const out: Array<{ kind: 'header'; label: string } | { kind: 'item'; n: any }> = [];
    let last = '';
    visible.forEach((n) => {
      const label = dayLabel(n.created_at);
      if (label !== last) { out.push({ kind: 'header', label }); last = label; }
      out.push({ kind: 'item', n });
    });
    return out;
  }, [visible]);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[400px] p-0 overflow-hidden bg-background border-l">
          <SheetTitle className="sr-only">Notifications</SheetTitle>
          <SheetDescription className="sr-only">Your recent notifications</SheetDescription>
          <div className="flex flex-col h-full">
            <div className="px-5 pt-6 pb-4 border-b">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold">Notifications</h2>
                </div>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="h-6 px-2">{unreadCount}</Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className="flex-1 rounded-xl"
                >
                  All <span className="ml-1.5 opacity-70">({notifications.length})</span>
                </Button>
                <Button
                  variant={filter === 'unread' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('unread')}
                  className="flex-1 rounded-xl"
                >
                  Unread <span className="ml-1.5 opacity-70">({unreadCount})</span>
                </Button>
              </div>

              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="w-full mt-2 rounded-xl text-primary hover:bg-primary/10"
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Mark all as read
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              {visible.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {filter === 'unread' ? 'All caught up!' : 'Notifications will appear here when you receive them'}
                  </p>
                </div>
              ) : (
                <ul className="py-2 animate-stagger">
                  {rows.map((row) => {
                    if (row.kind === 'header') {
                      return (
                        <li key={`h-${row.label}`} className="px-5 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {row.label}
                        </li>
                      );
                    }
                    const notification = row.n;
                    const unread = !notification.is_read;
                    const actorId = getNotificationActorId(notification) || notification?.data?.sender_id;
                    const actor = actorId ? actors[actorId] : undefined;
                    return (
                      <li key={notification.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openNotification(notification)}
                          onKeyDown={(e) => { if (e.key === 'Enter') openNotification(notification); }}
                          className={
                            unread
                              ? 'mx-2 my-0.5 flex items-start gap-3 rounded-2xl px-3 py-3 cursor-pointer bg-primary/15 border-l-4 border-primary hover:bg-primary/20 active:scale-[0.99] transition-all'
                              : 'mx-2 my-0.5 flex items-start gap-3 rounded-2xl px-3 py-3 cursor-pointer bg-background border-l-4 border-transparent hover:bg-muted/50 active:scale-[0.99] transition-all'
                          }
                        >
                          <div className="relative flex-shrink-0">
                            <Avatar className="h-11 w-11">
                              <AvatarImage src={actor?.avatar_url || undefined} />
                              <AvatarFallback className={unread ? 'bg-primary/20' : 'bg-muted'}>
                                {actor?.display_name ? actor.display_name[0]?.toUpperCase() : getNotificationIcon(notification.type)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background shadow ring-1 ring-border">
                              {getNotificationIcon(notification.type)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm leading-snug ${unread ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
                              {notification.title}
                            </h4>
                            {notification.content && (
                              <p className={`text-sm line-clamp-2 mt-0.5 ${unread ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                                {notification.content}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </p>
                            {ACTIONABLE_TYPES.has(notification.type) && (
                              <NotificationActions notification={notification} onDone={refetch} />
                            )}
                          </div>
                          {unread && <span className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>

            {notifications.length > 0 && (
              <div className="p-4 border-t">
                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  size="sm"
                  onClick={() => setShowClearAllDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Notifications
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all your notifications. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NotificationCenter;
