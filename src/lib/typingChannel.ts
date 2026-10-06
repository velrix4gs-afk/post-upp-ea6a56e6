import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface TypingEvent {
  user_id: string;
  display_name: string;
  is_typing: boolean;
}

type TypingListener = (event: TypingEvent) => void;
type StatusListener = (subscribed: boolean) => void;

interface SharedTypingChannel {
  channel: RealtimeChannel;
  listeners: Set<TypingListener>;
  statusListeners: Set<StatusListener>;
  subscribed: boolean;
  refCount: number;
}

// One realtime channel per chat, shared by every typing hook/component.
// Supabase reuses channels with the same topic, so registering a second
// `.on()` after `.subscribe()` throws and crashes the page — this registry
// attaches a single listener and fans events out instead.
const registry = new Map<string, SharedTypingChannel>();

export const acquireTypingChannel = (chatId: string) => {
  let shared = registry.get(chatId);
  if (!shared) {
    const channel = supabase.channel(`typing:${chatId}`, {
      config: { broadcast: { self: false, ack: true } },
    });
    const created: SharedTypingChannel = {
      channel,
      listeners: new Set(),
      statusListeners: new Set(),
      subscribed: false,
      refCount: 0,
    };
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      const event = payload.payload as TypingEvent;
      created.listeners.forEach((listener) => listener(event));
    });
    channel.subscribe((status) => {
      created.subscribed = status === 'SUBSCRIBED';
      created.statusListeners.forEach((listener) => listener(created.subscribed));
    });
    registry.set(chatId, created);
    shared = created;
  }
  shared.refCount += 1;
  const current = shared;

  return {
    isSubscribed: () => current.subscribed,
    send: (event: TypingEvent) =>
      current.subscribed
        ? current.channel.send({ type: 'broadcast', event: 'typing', payload: event })
        : Promise.resolve('skipped'),
    onEvent: (listener: TypingListener) => {
      current.listeners.add(listener);
      return () => { current.listeners.delete(listener); };
    },
    onStatus: (listener: StatusListener) => {
      current.statusListeners.add(listener);
      return () => { current.statusListeners.delete(listener); };
    },
    release: () => {
      current.refCount -= 1;
      if (current.refCount <= 0 && registry.get(chatId) === current) {
        registry.delete(chatId);
        void supabase.removeChannel(current.channel);
      }
    },
  };
};
