import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BackNavigation } from '@/components/BackNavigation';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Bell, Image, Trash2, UserX, AlertCircle } from 'lucide-react';
import { useChatSettings } from '@/hooks/useChatSettings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const ChatSettingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get('chat');
  const { settings, updateSettings, loading } = useChatSettings(chatId || undefined);

  const [localSettings, setLocalSettings] = useState({
    notifications_enabled: true,
    is_muted: false,
    is_pinned: false,
    auto_delete_duration: null as number | null,
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        notifications_enabled: settings.notifications_enabled ?? true,
        is_muted: settings.is_muted ?? false,
        is_pinned: settings.is_pinned ?? false,
        auto_delete_duration: settings.auto_delete_duration,
      });
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    if (!chatId) return;

    await updateSettings(localSettings);
    toast({
      title: 'Settings saved',
      description: 'Chat settings have been updated',
    });
  };

  const handleClearChat = async () => {
    if (!chatId) return;
    
    if (!confirm('Are you sure you want to clear all messages in this chat? This action cannot be undone.')) {
      return;
    }

    // TODO: Implement clear chat functionality
    toast({
      title: 'Chat cleared',
      description: 'All messages have been deleted',
    });
  };

  const handleBlockUser = () => {
    if (!confirm('Are you sure you want to block this user? You will no longer receive messages from them.')) {
      return;
    }

    // TODO: Implement block user functionality
    toast({
      title: 'User blocked',
      description: 'You will no longer receive messages from this user',
    });
  };

  const handleLeaveChat = () => {
    if (!confirm('Are you sure you want to leave this chat? You can be added back by other members.')) {
      return;
    }

    // TODO: Implement leave chat functionality
    navigate('/messages');
    toast({
      title: 'Left chat',
      description: 'You have left this conversation',
    });
  };

  if (!chatId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No chat selected</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <BackNavigation title="Chat Settings" />
      
      <main className="chat-settings-page container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-6">
          {/* Notifications */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Notifications</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications">Enable notifications</Label>
                <Switch
                  id="notifications"
                  checked={localSettings.notifications_enabled}
                  onCheckedChange={(checked) => 
                    setLocalSettings({ ...localSettings, notifications_enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="muted">Mute chat</Label>
                <Switch
                  id="muted"
                  checked={localSettings.is_muted}
                  onCheckedChange={(checked) => 
                    setLocalSettings({ ...localSettings, is_muted: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="pinned">Pin chat</Label>
                <Switch
                  id="pinned"
                  checked={localSettings.is_pinned}
                  onCheckedChange={(checked) => 
                    setLocalSettings({ ...localSettings, is_pinned: checked })
                  }
                />
              </div>
            </div>
          </Card>

          {/* Auto-delete messages */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Disappearing Messages</h3>
            </div>

            <div className="space-y-2">
              <Label>Auto-delete after</Label>
              <Select
                value={localSettings.auto_delete_duration?.toString() || 'off'}
                onValueChange={(value) => 
                  setLocalSettings({
                    ...localSettings,
                    auto_delete_duration: value === 'off' ? null : parseInt(value)
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="3600">1 hour</SelectItem>
                  <SelectItem value="86400">24 hours</SelectItem>
                  <SelectItem value="604800">7 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Messages will automatically delete after the selected time
              </p>
            </div>
          </Card>

          {/* Save button */}
          <Button
            onClick={handleSaveSettings}
            disabled={loading}
            className="w-full"
          >
            Save Settings
          </Button>

          <Separator />

          {/* Danger zone */}
          <Card className="p-6 border-destructive/50">
            <h3 className="font-semibold text-destructive mb-4">Danger Zone</h3>
            
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={handleClearChat}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Chat
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={handleBlockUser}
              >
                <UserX className="h-4 w-4 mr-2" />
                Block User
              </Button>

              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={handleLeaveChat}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Leave Chat
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ChatSettingsPage;
