import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

interface IncomingCall {
  call_id: string;
  caller_id: string;
  caller_name: string;
  caller_avatar?: string;
  call_type: 'voice' | 'video';
  timestamp: string;
}

interface CallSignalRow {
  id: string;
  call_id: string;
  sender_id: string;
  signal_type: string;
  signal_data?: { video?: boolean } | null;
  created_at: string;
}

export const useCallNotifications = () => {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [ringing, setRinging] = useState(false);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const processedSignalIdsRef = useRef(new Set<string>());
  const endedCallsRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (!user) return;

    // Subscribe to call signals for incoming calls
    const channel = supabase
      .channel('incoming_calls')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
      }, async (payload) => {
        const signal = payload.new as CallSignalRow;
        if (processedSignalIdsRef.current.has(signal.id)) return;
        processedSignalIdsRef.current.add(signal.id);
        if (processedSignalIdsRef.current.size > 500) {
          const oldestId = processedSignalIdsRef.current.values().next().value;
          if (oldestId) processedSignalIdsRef.current.delete(oldestId);
        }

        if (
          (signal.signal_type === 'cancel' || signal.signal_type === 'decline') &&
          signal.sender_id !== user.id
        ) {
          endedCallsRef.current.set(signal.call_id, new Date(signal.created_at).getTime());
          if (endedCallsRef.current.size > 500) {
            const oldestCallId = endedCallsRef.current.keys().next().value;
            if (oldestCallId) endedCallsRef.current.delete(oldestCallId);
          }
          if (incomingCallRef.current?.call_id === signal.call_id) {
            incomingCallRef.current = null;
            setIncomingCall(null);
            setRinging(false);
          }
          if (signal.signal_type === 'cancel') return;
        }

        // Check if this is an offer signal (incoming call) for this user.
        // Also skip offers we sent ourselves -- the caller is a participant
        // in their own chat too, so without this check they'd get their
        // own incoming-call popup for the call they just placed.
        if (signal.signal_type === 'offer' && signal.sender_id !== user.id) {
          // Get chat to verify we're a participant
          const { data: chatData } = await supabase
            .from('chats')
            .select('*, chat_participants!inner(user_id)')
            .eq('id', signal.call_id)
            .eq('chat_participants.user_id', user.id)
            .single();

          if (!chatData) return; // Not for us

          // Get caller info
          const { data: callerProfile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', signal.sender_id)
            .single();

          // Determine call type from signal data
          const callType = signal.signal_data?.video ? 'video' : 'voice';

          const callInfo: IncomingCall = {
            call_id: signal.call_id,
            caller_id: signal.sender_id,
            caller_name: callerProfile?.display_name || 'Someone',
            caller_avatar: callerProfile?.avatar_url,
            call_type: callType,
            timestamp: signal.created_at
          };
          const endedAt = endedCallsRef.current.get(callInfo.call_id);
          if (endedAt && new Date(signal.created_at).getTime() <= endedAt) return;

          incomingCallRef.current = callInfo;
          setIncomingCall(callInfo);
          setRinging(true);

          // Show browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Incoming ${callType} call`, {
              body: `${callInfo.caller_name} is calling you`,
              icon: callInfo.caller_avatar || '/favicon.ico',
              tag: `call-${callInfo.call_id}`,
            });
          }

          // Show toast notification
          toast({
            title: `Incoming ${callType} call`,
            description: `${callInfo.caller_name} is calling you`,
            duration: 30000, // 30 seconds
          });

        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const acceptCall = () => {
    setRinging(false);
    const call = incomingCallRef.current;
    incomingCallRef.current = null;
    setIncomingCall(null);
    return call;
  };

  const declineCall = async () => {
    if (!incomingCall) return;

    const { error } = await supabase
      .from('call_signals')
      .insert({
        call_id: incomingCall.call_id,
        sender_id: user?.id,
        signal_type: 'decline',
        signal_data: {}
      });
    if (error) {
      console.error('[calls] failed to decline call', error);
      toast({
        title: 'Could not decline call',
        description: 'The call may still be ringing. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setRinging(false);
    incomingCallRef.current = null;
    setIncomingCall(null);

    toast({
      title: 'Call declined',
      description: `You declined the call from ${incomingCall.caller_name}`,
    });
  };

  return {
    incomingCall,
    ringing,
    acceptCall,
    declineCall,
  };
};