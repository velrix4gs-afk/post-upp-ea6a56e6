import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Marks incoming messages as "delivered" (double white check for the sender) as soon as this
 * device is online: on app open, whenever a new message arrives, and when the tab regains focus.
 * Messages that are already "read" are never touched (the RPC only upgrades "sent").
 */
export const useDeliveryReceipts = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mark = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void supabase.rpc('mark_messages_delivered').then(({ error }) => {
          if (error) console.warn('[delivery] could not mark delivered', error.message);
        });
      }, 300);
    };

    mark();
    const channel = supabase
      .channel(`delivery-receipts:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if ((payload.new as { sender_id?: string }).sender_id !== user.id) mark();
      })
      .subscribe();

    const onVisible = () => { if (document.visibilityState === 'visible') mark(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', mark);

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', mark);
    };
  }, [user?.id]);
};
