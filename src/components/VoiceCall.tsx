import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Video, Loader2 } from 'lucide-react';
import {
  StreamVideo,
  StreamCall,
  ParticipantsAudio,
  useCallStateHooks,
  type Call,
  CallingState,
} from '@stream-io/video-react-sdk';
import { useStreamVideoClient, callIdForChat } from '@/hooks/useStreamVideoClient';
import { CallShell } from '@/components/calls/CallShell';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CallOutcome {
  status: 'completed' | 'declined' | 'unanswered';
  durationSec: number;
}

interface VoiceCallProps {
  chatId: string;
  isInitiator: boolean;
  onEndCall: (outcome: CallOutcome) => void;
  participantName?: string;
  participantAvatar?: string;
}

const RING_TIMEOUT_MS = 45_000;

export const VoiceCall = ({
  chatId,
  isInitiator,
  onEndCall,
  participantName = 'User',
  participantAvatar,
}: VoiceCallProps) => {
  const { user } = useAuth();
  const { client, error: clientError } = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);
  const [minimized, setMinimized] = useState(false);
  const callId = useMemo(() => callIdForChat(chatId, 'voice'), [chatId]);

  const hasConnectedRef = useRef(false);
  const durationRef = useRef(0);
  const endedRef = useRef(false);

  const finish = (status: CallOutcome['status']) => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEndCall({ status, durationSec: durationRef.current });
  };

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const c = client.call('audio_room', callId);
    (async () => {
      try {
        await c.join({ create: true });
        await c.microphone.enable();
        await c.camera.disable();
        if (!cancelled) setCall(c);
      } catch (e) {
        console.error('[VoiceCall] join failed', e);
        finish('unanswered');
      }
    })();
    return () => {
      cancelled = true;
      c.leave().catch(() => { });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, callId]);

  useEffect(() => {
    if (clientError) finish('unanswered');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientError]);

  // Notifies the other participant (via IncomingCallOverlay, which listens
  // on the call_signals table) that a call is coming in, and listens for
  // their decline so the caller side can end/log the call correctly.
  // This bridge didn't exist before -- Stream connected the call on its own
  // servers but the other person was never told anything was happening.
  useEffect(() => {
    if (!isInitiator || !user) return;

    supabase.from('call_signals').insert({
      call_id: chatId,
      sender_id: user.id,
      signal_type: 'offer',
      signal_data: { video: false },
    }).then(() => { });

    const channel = supabase
      .channel(`call-outcome-${chatId}-${callId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_signals' },
        (payload) => {
          const signal = payload.new as any;
          if (signal.call_id !== chatId || signal.sender_id === user.id) return;
          if (signal.signal_type === 'decline' && !hasConnectedRef.current) {
            finish('declined');
          }
        },
      )
      .subscribe();

    const timeout = setTimeout(() => {
      if (!hasConnectedRef.current) {
        supabase.from('call_signals').insert({
          call_id: chatId,
          sender_id: user.id,
          signal_type: 'cancel',
          signal_data: {},
        }).then(() => { });
        finish('unanswered');
      }
    }, RING_TIMEOUT_MS);

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitiator, user, chatId, callId]);

  const end = () => {
    haptic('heavy');
    finish(hasConnectedRef.current ? 'completed' : isInitiator ? 'unanswered' : 'declined');
  };

  if (!client || !call) {
    return (
      <CallShell
        kind="voice"
        participantName={participantName}
        participantAvatar={participantAvatar}
        statusText={isInitiator ? 'Calling…' : 'Connecting…'}
        minimized={minimized}
        onMinimize={() => setMinimized(true)}
        onRestore={() => setMinimized(false)}
        onEnd={end}
        controls={
          <div className="flex justify-center">
            <Button
              size="icon"
              variant="destructive"
              onClick={end}
              className="h-16 w-16 rounded-full shadow-lg touch-manipulation"
              aria-label="Cancel call"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <VoiceCallInner
          onEnd={end}
          minimized={minimized}
          setMinimized={setMinimized}
          participantName={participantName}
          participantAvatar={participantAvatar}
          hasConnectedRef={hasConnectedRef}
          durationRef={durationRef}
        />
      </StreamCall>
    </StreamVideo>
  );
};

interface InnerProps {
  onEnd: () => void;
  minimized: boolean;
  setMinimized: (v: boolean) => void;
  participantName: string;
  participantAvatar?: string;
  hasConnectedRef: React.MutableRefObject<boolean>;
  durationRef: React.MutableRefObject<number>;
}

const VoiceCallInner = ({
  onEnd,
  minimized,
  setMinimized,
  participantName,
  participantAvatar,
  hasConnectedRef,
  durationRef,
}: InnerProps) => {
  const { useCallCallingState, useMicrophoneState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { microphone, isMute } = useMicrophoneState();
  const participants = useParticipants();
  const remoteParticipants = participants.filter((p) => !p.isLocalParticipant);

  const [callDuration, setCallDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const isConnected = callingState === CallingState.JOINED && remoteParticipants.length > 0;

  useEffect(() => {
    if (isConnected) hasConnectedRef.current = true;
  }, [isConnected, hasConnectedRef]);

  useEffect(() => {
    if (!isConnected) return;
    const id = setInterval(() => setCallDuration((d) => {
      durationRef.current = d + 1;
      return d + 1;
    }), 1000);
    return () => clearInterval(id);
  }, [isConnected, durationRef]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  };

  const toggleMic = async () => {
    haptic('light');
    await microphone.toggle();
  };

  const toggleSpeaker = () => {
    haptic('light');
    setSpeakerOn((v) => !v);
    document.querySelectorAll('audio[data-stream-audio]').forEach((el) => {
      (el as HTMLAudioElement).muted = speakerOn;
    });
  };

  const statusText = isConnected
    ? formatDuration(callDuration)
    : callingState === CallingState.RINGING
      ? 'Ringing…'
      : 'Connecting…';

  const controls = (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      <Button
        size="icon"
        variant={speakerOn ? 'secondary' : 'outline'}
        onClick={toggleSpeaker}
        className="h-14 w-14 rounded-full touch-manipulation"
        aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}
      >
        {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </Button>
      <Button
        size="icon"
        variant={!isMute ? 'secondary' : 'destructive'}
        onClick={toggleMic}
        className="h-14 w-14 rounded-full touch-manipulation"
        aria-label={!isMute ? 'Mute' : 'Unmute'}
      >
        {!isMute ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </Button>
      <Button
        size="icon"
        variant="secondary"
        disabled
        className="h-14 w-14 rounded-full touch-manipulation opacity-60"
        aria-label="Switch to video"
      >
        <Video className="h-5 w-5" />
      </Button>
      <Button
        size="icon"
        variant="destructive"
        onClick={onEnd}
        className="h-16 w-16 rounded-full shadow-lg touch-manipulation"
        aria-label="End call"
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
    </div>
  );

  return (
    <CallShell
      kind="voice"
      participantName={participantName}
      participantAvatar={participantAvatar}
      statusText={statusText}
      minimized={minimized}
      onMinimize={() => setMinimized(true)}
      onRestore={() => setMinimized(false)}
      onEnd={onEnd}
      hiddenStreamMount={<ParticipantsAudio participants={remoteParticipants} />}
      controls={controls}
    />
  );
};

export default VoiceCall;