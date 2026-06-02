import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Bell, 
  Heart, 
  MessageCircle, 
  UserPlus, 
  Share2,
  AtSign,
  CheckCheck,
  Settings2,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface NotificationGroup {
  id: string;
  type: string;
  count: number;
  notifications: any[];
  latestTimestamp: string;
  relatedId?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter = ({ isOpen, onClose }: NotificationCenterProps) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, refetch } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [expandedGroup, setExpandedGroup] = useState<NotificationGroup | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const navigate = useNavigate();
  const autoReadFiredRef = useRef(false);

  // Auto mark-as-read when the panel opens, so the badge clears instantly.
  useEffect(() => {
    if (!isOpen) {
      autoReadFiredRef.current = false;
      return;
    }
    if (autoReadFiredRef.current) return;
    if (unreadCount > 0) {
      autoReadFiredRef.current = true;
      const t = setTimeout(() => { markAllAsRead(); }, 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, unreadCount]);

  const clearNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      if (error) throw error;
      await refetch(); // Refresh notifications list
    } catch (err) {
      console.error('Error clearing notification:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setShowClearAllDialog(false);
      setExpandedGroup(null);
      await refetch(); // Refresh notifications from database
      
      toast({
        title: 'Notifications cleared',
        description: 'All notifications have been removed'
      });
    } catch (err) {
      console.error('Error clearing all notifications:', err);
      toast({
        title: 'Error',
        description: 'Failed to clear notifications',
        variant: 'destructive'
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'friend_request':
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'follow':
        return <UserPlus className="h-4 w-4 text-purple-500" />;
      case 'share':
        return <Share2 className="h-4 w-4 text-orange-500" />;
      case 'mention':
        return <AtSign className="h-4 w-4 text-yellow-500" />;
      case 'message':
        return <MessageCircle className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  // Group notifications by type and related content
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: NotificationGroup } = {};
    
    filteredNotifications.forEach((notification) => {
      // Create a grouping key based on type and related content
      let groupKey: string = notification.type;
      
      // For post-related notifications, group by post_id
      if (notification.data?.post_id) {
        groupKey = `${notification.type}_post_${notification.data.post_id}` as string;
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          type: notification.type as string,
          count: 0,
          notifications: [],
          latestTimestamp: notification.created_at,
          relatedId: notification.data?.post_id
        };
      }
      
      groups[groupKey].notifications.push(notification);
      groups[groupKey].count++;
      
      // Update to latest timestamp
      if (new Date(notification.created_at) > new Date(groups[groupKey].latestTimestamp)) {
        groups[groupKey].latestTimestamp = notification.created_at;
      }
    });
    
    // Convert to array and sort by latest timestamp
    return Object.values(groups).sort((a, b) => 
      new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime()
    );
  }, [filteredNotifications]);

  const getGroupTitle = (group: NotificationGroup) => {
    const { type, count } = group;
    
    if (count === 1) {
      return group.notifications[0].title;
    }
    
    switch (type) {
      case 'like':
        return `${count} people liked your post`;
      case 'comment':
        return `${count} new comments on your post`;
      case 'follow':
        return `${count} new followers`;
      case 'friend_request':
        return `${count} friend requests`;
      case 'mention':
        return `${count} mentions`;
      case 'share':
        return `${count} people shared your post`;
      case 'message':
        return `${count} new messages`;
      default:
        return `${count} notifications`;
    }
  };

  const getGroupDescription = (group: NotificationGroup) => {
    if (group.count === 1) {
      return group.notifications[0].content || '';
    }
    
    const names = group.notifications
      .slice(0, 3)
      .map(n => n.title.split(' ')[0])
      .join(', ');
    
    return group.count > 3 
      ? `${names} and ${group.count - 3} others`
      : names;
  };

  const hasUnreadInGroup = (group: NotificationGroup) => {
    return group.notifications.some(n => !n.is_read);
  };

  const markGroupAsRead = (group: NotificationGroup) => {
    group.notifications.forEach(notification => {
      if (!notification.is_read) {
        markAsRead(notification.id);
      }
    });
  };

  return (
    <>
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[400px] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-l">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b bg-background/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {expandedGroup ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedGroup(null)}
                      className="h-10 w-10 rounded-full hover:bg-primary/10"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">{getGroupTitle(expandedGroup)}</h2>
                      <p className="text-xs text-muted-foreground">{expandedGroup.count} notifications</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bell className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold">Notifications</h2>
                  </>
                )}
              </div>
              {!expandedGroup && unreadCount > 0 && (
                <Badge variant="destructive" className="h-6 px-2">
                  {unreadCount}
                </Badge>
              )}
            </div>

            {!expandedGroup && (
              <>
                {/* Filter buttons */}
                <div className="flex gap-2">
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                    className="flex-1 rounded-xl transition-all duration-300"
                  >
                    All <span className="ml-1.5 opacity-70">({notifications.length})</span>
                  </Button>
                  <Button
                    variant={filter === 'unread' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('unread')}
                    className="flex-1 rounded-xl transition-all duration-300"
                  >
                    Unread <span className="ml-1.5 opacity-70">({unreadCount})</span>
                  </Button>
                </div>

                {unreadCount > 0 && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={markAllAsRead}
                    className="w-full mt-3 rounded-xl transition-all duration-300 bg-primary hover:bg-primary/90"
                  >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Mark All as Read
                  </Button>
                )}
                
                {notifications.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowClearAllDialog(true)}
                    className="w-full mt-2 rounded-xl transition-all duration-300"
                  >
                    Clear All Notifications
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Notifications list */}
          <ScrollArea className="flex-1 px-4">
            {expandedGroup ? (
              // Show individual notifications in expanded group
              <div className="space-y-1.5 py-4">
                {expandedGroup.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`group flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.02] ${
                      !notification.is_read 
                        ? 'bg-primary/5 hover:bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        !notification.is_read ? 'bg-primary/10 group-hover:bg-primary/20' : 'bg-muted'
                      }`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors duration-300">
                            {notification.title}
                          </h4>
                          {notification.content && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {notification.content}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.is_read && (
                            <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNotification(notification.id);
                            }}
                          >
                            <span className="text-lg">×</span>
                          </Button>
                        </div>
                      </div>

                      {/* Action buttons for friend requests */}
                      {notification.type === 'friend_request' && notification.data?.friendship_id && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" className="h-8 px-3 text-xs rounded-lg flex-1">
                            Accept
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 px-3 text-xs rounded-lg flex-1">
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Show grouped notifications
              <>
                {groupedNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="h-16 w-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                      <Bell className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {filter === 'unread' 
                        ? 'All caught up!' 
                        : 'Notifications will appear here when you receive them'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-4">
                    {groupedNotifications.map((group) => (
                      <div
                        key={group.id}
                        className={`group flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.02] ${
                          hasUnreadInGroup(group)
                            ? 'bg-primary/5 hover:bg-primary/10 border border-primary/20' 
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => {
                          if (group.count > 1) {
                            setExpandedGroup(group);
                            markGroupAsRead(group);
                          } else {
                            if (!group.notifications[0].is_read) {
                              markAsRead(group.notifications[0].id);
                            }
                          }
                        }}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 relative ${
                            hasUnreadInGroup(group) ? 'bg-primary/10 group-hover:bg-primary/20' : 'bg-muted'
                          }`}>
                            {getNotificationIcon(group.type)}
                            {group.count > 1 && (
                              <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                                {group.count}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors duration-300">
                                {getGroupTitle(group)}
                              </h4>
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {getGroupDescription(group)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(group.latestTimestamp), { addSuffix: true })}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              {hasUnreadInGroup(group) && (
                                <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
                              )}
                              {group.count > 1 && (
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && !expandedGroup && (
            <div className="p-4 border-t bg-background/50 space-y-2">
              <Button 
                variant="outline" 
                className="w-full rounded-xl hover:bg-primary/10 transition-all duration-300" 
                size="sm"
                onClick={() => {
                  onClose();
                  navigate('/settings?tab=notifications');
                }}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Notification Preferences
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
            This will permanently delete all your notifications. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Clear All
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};

export default NotificationCenter;
