import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { NotificationActions, getActorId } from '@/components/NotificationActions';

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
    const data = notification.data || {};
    const postId = data.post_id;
    const chatId = data.chat_id;
    const actorId = getActorId(notification);

    if (chatId && (notification.type === 'message' || notification.type === 'voice_call' || notification.type === 'video_call')) {
      onClose();
      navigate(`/messages?chat=${chatId}`);
      return;
    }
    if (postId) {
      onClose();
      const commentHash = data.comment_id ? `#comment-${data.comment_id}` : notification.type === 'comment' ? '#comments' : '';
      navigate(`/post/${postId}${commentHash}`);
      return;
    }
    if (actorId) {
      onClose();
      navigate(`/profile/${actorId}`);
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
                <ul className="py-2">
                  {visible.map((notification) => {
                    const unread = !notification.is_read;
                    return (
                      <li key={notification.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openNotification(notification)}
                          onKeyDown={(e) => { if (e.key === 'Enter') openNotification(notification); }}
                          className={
                            unread
                              // Unread: clearly darker/tinted row with an accent bar.
                              ? 'flex items-start gap-3 px-5 py-3.5 cursor-pointer bg-primary/15 border-l-4 border-primary hover:bg-primary/20 transition-colors'
                              // Read: light, quiet row.
                              : 'flex items-start gap-3 px-5 py-3.5 cursor-pointer bg-background border-l-4 border-transparent hover:bg-muted/50 transition-colors'
                          }
                        >
                          <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center ${unread ? 'bg-primary/20' : 'bg-muted'}`}>
                            {getNotificationIcon(notification.type)}
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
