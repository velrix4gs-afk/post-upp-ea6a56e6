import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Heart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { showCleanError } from '@/lib/errorHandler';

interface TipDialogProps {
  recipientId: string;
  recipientName: string;
  /**
   * When false (or omitted with strict=true), the trigger button is not
   * rendered. Pass the recipient profile's is_verified flag here so tipping
   * is only offered for verified creators.
   */
  recipientVerified?: boolean;
  /** When true, the trigger is hidden unless recipientVerified === true. */
  strict?: boolean;
}

export const TipDialog = ({
  recipientId,
  recipientName,
  recipientVerified,
  strict = true,
}: TipDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('1');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Per plan: tipping is restricted to verified creators. Hide trigger
  // entirely when the recipient is not verified to avoid dead UI.
  if (strict && !recipientVerified) return null;

  const predefinedAmounts = ['1', '5', '10', '25', '50'];

  const handleSendTip = async () => {
    if (!user) {
      toast({
        title: '⚠️ AUTH_001',
        description: 'Please sign in to send tips',
        variant: 'destructive'
      });
      return;
    }

    // Check if sender is verified
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', user.id)
      .single();

    if (!profile?.is_verified) {
      toast({
        title: '⚠️ TIP_005',
        description: 'You must be verified to send tips. Visit /verification to get verified!',
        variant: 'destructive',
        duration: 8000
      });
      // Redirect after showing toast
      setTimeout(() => {
        window.location.href = '/verification';
      }, 2000);
      return;
    }

    const tipAmount = parseInt(amount);
    if (isNaN(tipAmount) || tipAmount < 1) {
      toast({
        title: '⚠️ TIP_001',
        description: 'Please enter a valid amount (minimum 1 coin)',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('process-tip', {
        body: {
          recipient_id: recipientId,
          amount: tipAmount,
          message: message.trim() || null
        }
      });

      if (error) throw error;

      toast({
        title: '✅ Success',
        description: `You sent ${tipAmount} coins to ${recipientName}`,
        duration: 5000
      });

      setOpen(false);
      setAmount('1');
      setMessage('');
    } catch (err: any) {
      console.error('[TIP_002] Error sending tip:', err);
      showCleanError(err, toast, 'Tip Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DollarSign className="h-4 w-4 mr-2" />
          Tip
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Send a Tip to {recipientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Amount (Coins)</Label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {predefinedAmounts.map((amt) => (
                <Button
                  key={amt}
                  variant={amount === amt ? 'default' : 'outline'}
                  onClick={() => setAmount(amt)}
                  type="button"
                >
                  {amt}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              placeholder="Enter custom amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              step="1"
            />
            <p className="text-xs text-muted-foreground">1 coin = $0.01</p>
          </div>

          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Input
              placeholder="Add a nice message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSendTip} disabled={loading} className="flex-1">
              {loading ? 'Processing...' : `Send ${amount || '0'} coins`}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
