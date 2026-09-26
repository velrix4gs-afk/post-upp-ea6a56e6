import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ClearChatDialogProps {
  chatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleared: () => void;
}

export const ClearChatDialog = ({ chatId, open, onOpenChange, onCleared }: ClearChatDialogProps) => {
  const { user } = useAuth();
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (!user || clearing) return;

    setClearing(true);
    try {
      const { error } = await supabase.rpc('clear_chat_for_user', { p_chat_id: chatId });
      if (error) throw error;

      toast({ title: 'Chat history cleared' });
      onCleared();
      onOpenChange(false);
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast({ title: 'Failed to clear chat', variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
          <AlertDialogDescription>
            This will clear all messages from this chat for you. Other participants will still see the messages. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleClear} disabled={clearing} className="bg-destructive text-destructive-foreground">
            {clearing ? 'Clearing…' : 'Clear Chat'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
