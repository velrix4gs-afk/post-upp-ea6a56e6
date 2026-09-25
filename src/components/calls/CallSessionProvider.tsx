import { useCallback, useState, type ReactNode } from 'react';
import { VideoCall } from '@/components/VideoCall';
import { VoiceCall, type CallOutcome } from '@/components/VoiceCall';
import { CallSessionContext, type CallSession } from '@/components/calls/CallSessionContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const CallSessionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);

  const startCall = useCallback((session: CallSession) => {
    if (!user) {
      toast({ title: 'Sign in to call', variant: 'destructive' });
      return false;
    }
    if (activeCall) {
      toast({ title: 'A call is already active', description: 'End it before starting another call.' });
      return false;
    }
    setActiveCall(session);
    return true;
  }, [activeCall, user]);

  const handleEndCall = useCallback(async (outcome: CallOutcome) => {
    const endedCall = activeCall;
    setActiveCall(null);
    if (!endedCall?.isInitiator || !user) return;

    const { error } = await supabase.from('messages').insert({
      chat_id: endedCall.chatId,
      sender_id: user.id,
      content: JSON.stringify({
        kind: endedCall.kind,
        status: outcome.status,
        durationSec: outcome.durationSec,
      }),
      media_type: 'call',
      status: 'sent',
    });

    if (error) {
      console.error('[CallSessionProvider] failed to save call summary', error);
      toast({ title: 'Call ended, but its summary could not be saved', variant: 'destructive' });
    }
  }, [activeCall, user]);

  return (
    <CallSessionContext.Provider value={{ activeCall, startCall }}>
      {children}
      {activeCall?.kind === 'voice' && (
        <VoiceCall
          chatId={activeCall.chatId}
          isInitiator={activeCall.isInitiator}
          participantName={activeCall.participantName}
          participantAvatar={activeCall.participantAvatar}
          onEndCall={handleEndCall}
        />
      )}
      {activeCall?.kind === 'video' && (
        <VideoCall
          chatId={activeCall.chatId}
          isInitiator={activeCall.isInitiator}
          participantName={activeCall.participantName}
          participantAvatar={activeCall.participantAvatar}
          onEndCall={handleEndCall}
        />
      )}
    </CallSessionContext.Provider>
  );
};
