import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadReceiptIndicatorProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isOwn: boolean;
}

export const ReadReceiptIndicator = ({ status, isOwn }: ReadReceiptIndicatorProps) => {
  if (!isOwn || status === 'failed') return null;

  if (status === 'sending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <div className="h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
      </span>
    );
  }

  // Tick colours follow the WhatsApp convention the app is imitating:
  //   one white tick       -> sent, not yet on their device
  //   two blue ticks       -> delivered, not opened
  //   two purple ticks     -> read
  // The bubble can be tinted (wallpaper themes, custom bubble colours), so
  // these are fixed colours rather than theme tokens: they must stay legible
  // on every bubble, and their meaning is the colour.
  if (status === 'sent') {
    return (
      <Check className="h-3 w-3 text-white" aria-label="Sent" />
    );
  }

  if (status === 'delivered') {
    return (
      <CheckCheck className="h-3 w-3 text-sky-400" aria-label="Delivered" />
    );
  }

  if (status === 'read') {
    return (
      <CheckCheck className="h-3 w-3 text-[hsl(262_83%_70%)]" aria-label="Read" />
    );
  }

  return null;
};
