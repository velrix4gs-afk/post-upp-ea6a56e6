import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DisappearingMessagesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
}

export const DisappearingMessagesDialog = ({ isOpen, onClose, chatId }: DisappearingMessagesDialogProps) => {
  const [duration, setDuration] = useState<string>('off');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadSettings = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error loading current user for disappearing-message settings:', userError);
        toast({ title: 'Could not load disappearing-message settings', variant: 'destructive' });
        return;
      }
      if (!user) {
        toast({ title: 'Sign in to view chat settings', variant: 'destructive' });
        return;
      }
      const { data, error } = await supabase
        .from('chat_settings')
        .select('auto_delete_duration')
        .eq('chat_id', chatId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Error loading disappearing-message settings:', error);
        toast({ title: 'Could not load disappearing-message settings', variant: 'destructive' });
        return;
      }
      if (cancelled) return;
      const minutes = data?.auto_delete_duration ? String(data.auto_delete_duration / 60) : 'off';
      setDuration(['5', '30', '60', '1440', '10080'].includes(minutes) ? minutes : 'off');
    };
    void loadSettings();
    return () => { cancelled = true; };
  }, [chatId, isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in',
          variant: 'destructive',
        });
        return;
      }

      // Save to database
      const autoDurationSeconds = duration === 'off' ? null : parseInt(duration) * 60;
      
      const { error } = await supabase
        .from('chat_settings')
        .upsert({
          chat_id: chatId,
          user_id: user.id,
          auto_delete_duration: autoDurationSeconds
        }, { onConflict: 'chat_id,user_id' });

      if (error) {
        throw error;
      }

      window.dispatchEvent(new CustomEvent('chat-settings-updated', {
        detail: { chatId, updates: { auto_delete_duration: autoDurationSeconds } },
      }));
      toast({
        title: duration === 'off' ? 'Disappearing messages disabled' : 'Disappearing messages enabled',
        description: duration === 'off'
          ? 'New messages you send will not auto-delete'
          : `New messages you send will disappear for everyone after ${duration} minutes`,
      });
      onClose();
    } catch (error) {
      console.error('Error saving disappearing messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disappearing Messages</DialogTitle>
          <DialogDescription>
            New messages you send will disappear for everyone after the selected time. Other participants’ messages follow their own settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Auto-delete after</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="1440">24 hours</SelectItem>
                <SelectItem value="10080">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};