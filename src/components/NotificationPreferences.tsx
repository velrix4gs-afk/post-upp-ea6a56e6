import { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  Heart, 
  MessageCircle, 
  UserPlus, 
  AtSign,
  Share2,
  Users,
  CheckCheck,
  Phone,
  Video
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface NotificationPreferencesProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationPreferences = ({ isOpen, onOpenChange }: NotificationPreferencesProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Delivery methods
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  
  // Notification types
  const [likesEnabled, setLikesEnabled] = useState(true);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [messagesEnabled, setMessagesEnabled] = useState(true);
  const [followsEnabled, setFollowsEnabled] = useState(true);
  const [friendRequestsEnabled, setFriendRequestsEnabled] = useState(true);
  const [mentionsEnabled, setMentionsEnabled] = useState(true);
  const [sharesEnabled, setSharesEnabled] = useState(true);
  const [groupActivityEnabled, setGroupActivityEnabled] = useState(true);
  const [voiceCallsEnabled, setVoiceCallsEnabled] = useState(true);
  const [videoCallsEnabled, setVideoCallsEnabled] = useState(true);

  useEffect(() => {
    if (user && isOpen) {
      loadPreferences();
    }
  }, [user, isOpen]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        // Delivery methods
        setPushEnabled(data.sms_notifications ?? true);
        setEmailEnabled(data.email_enabled ?? true);
        setSmsEnabled(data.sms_enabled ?? false);
        
        // Notification types
        setLikesEnabled(data.likes ?? true);
        setCommentsEnabled(data.comments ?? true);
        setMessagesEnabled(data.messages ?? true);
        setFollowsEnabled(data.follows ?? true);
        setFriendRequestsEnabled(data.friend_requests ?? true);
        setMentionsEnabled(data.mentions ?? true);
        setSharesEnabled(data.shares ?? true);
        setGroupActivityEnabled(data.group_activity ?? true);
        setVoiceCallsEnabled(data.voice_calls ?? true);
        setVideoCallsEnabled(data.video_calls ?? true);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const updatePreference = async (field: string, value: boolean) => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ [field]: value } as any)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Preferences updated',
        description: 'Your notification preferences have been saved.',
      });
    } catch (error) {
      console.error('Error updating preference:', error);
      toast({
        title: 'Error',
        description: 'Failed to update notification preferences.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const PreferenceItem = ({ 
    icon: Icon, 
    label, 
    description,
    checked, 
    onCheckedChange 
  }: { 
    icon: any; 
    label: string;
    description: string;
    checked: boolean; 
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <div className="group flex items-start gap-4 p-4 rounded-xl hover:bg-muted/50 transition-all duration-300">
      <div className="h-10 w-10 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center flex-shrink-0 transition-all duration-300 mt-1">
        <Icon className="h-5 w-5 text-foreground group-hover:text-primary transition-colors duration-300" />
      </div>
      <div className="flex-1 min-w-0 pt-1.5">
        <h4 className="text-sm font-semibold text-foreground mb-0.5">{label}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch 
        checked={checked} 
        onCheckedChange={onCheckedChange}
        disabled={loading}
        className="mt-2"
      />
    </div>
  );

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[450px] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-l">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b bg-background/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Notification Preferences</h2>
                <p className="text-sm text-muted-foreground">Customize how you receive updates</p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 px-6">
            <div className="py-6 space-y-6">
              {/* Delivery Methods Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Delivery Methods
                  </h3>
                </div>
                <div className="space-y-2">
                  <PreferenceItem
                    icon={Bell}
                    label="Push Notifications"
                    description="Get instant alerts on your device"
                    checked={pushEnabled}
                    onCheckedChange={(checked) => {
                      setPushEnabled(checked);
                      updatePreference('sms_notifications', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={Mail}
                    label="Email Notifications"
                    description="Receive updates via email"
                    checked={emailEnabled}
                    onCheckedChange={(checked) => {
                      setEmailEnabled(checked);
                      updatePreference('email_enabled', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={Smartphone}
                    label="SMS Notifications"
                    description="Get text messages for important alerts"
                    checked={smsEnabled}
                    onCheckedChange={(checked) => {
                      setSmsEnabled(checked);
                      updatePreference('sms_enabled', checked);
                    }}
                  />
                </div>
              </div>

              <Separator className="bg-border/50" />

              {/* Notification Types Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Notification Types
                  </h3>
                </div>
                <div className="space-y-2">
                  <PreferenceItem
                    icon={Heart}
                    label="Likes & Reactions"
                    description="When someone likes or reacts to your posts"
                    checked={likesEnabled}
                    onCheckedChange={(checked) => {
                      setLikesEnabled(checked);
                      updatePreference('likes', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={MessageCircle}
                    label="Comments"
                    description="When someone comments on your posts"
                    checked={commentsEnabled}
                    onCheckedChange={(checked) => {
                      setCommentsEnabled(checked);
                      updatePreference('comments', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={MessageCircle}
                    label="Direct Messages"
                    description="When you receive a new message"
                    checked={messagesEnabled}
                    onCheckedChange={(checked) => {
                      setMessagesEnabled(checked);
                      updatePreference('messages', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={UserPlus}
                    label="Follows"
                    description="When someone follows you"
                    checked={followsEnabled}
                    onCheckedChange={(checked) => {
                      setFollowsEnabled(checked);
                      updatePreference('follows', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={Users}
                    label="Friend Requests"
                    description="When someone sends you a friend request"
                    checked={friendRequestsEnabled}
                    onCheckedChange={(checked) => {
                      setFriendRequestsEnabled(checked);
                      updatePreference('friend_requests', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={AtSign}
                    label="Mentions"
                    description="When someone mentions you in a post or comment"
                    checked={mentionsEnabled}
                    onCheckedChange={(checked) => {
                      setMentionsEnabled(checked);
                      updatePreference('mentions', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={Share2}
                    label="Shares"
                    description="When someone shares your post"
                    checked={sharesEnabled}
                    onCheckedChange={(checked) => {
                      setSharesEnabled(checked);
                      updatePreference('shares', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={Users}
                    label="Group Activity"
                    description="Updates from groups you're part of"
                    checked={groupActivityEnabled}
                    onCheckedChange={(checked) => {
                      setGroupActivityEnabled(checked);
                      updatePreference('group_activity', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={Phone}
                    label="Voice Calls"
                    description="Notifications for incoming voice calls"
                    checked={voiceCallsEnabled}
                    onCheckedChange={(checked) => {
                      setVoiceCallsEnabled(checked);
                      updatePreference('voice_calls', checked);
                    }}
                  />
                  <PreferenceItem
                    icon={Video}
                    label="Video Calls"
                    description="Notifications for incoming video calls"
                    checked={videoCallsEnabled}
                    onCheckedChange={(checked) => {
                      setVideoCallsEnabled(checked);
                      updatePreference('video_calls', checked);
                    }}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-6 border-t bg-background/50">
            <Button 
              variant="outline" 
              className="w-full rounded-xl hover:bg-primary/10 transition-all duration-300" 
              onClick={() => onOpenChange(false)}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
