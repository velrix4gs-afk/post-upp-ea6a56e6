import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff, RefreshCw, Loader2 } from 'lucide-react';
import {
  StreamVideo,
  StreamCall,
  SpeakerLayout,
  useCallStateHooks,
  type Call,
  CallingState,
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { useStreamVideoClient, callIdForChat } from '@/hooks/useStreamVideoClient';
import { CallShell } from '@/components/calls/CallShell';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { CallOutcome } from '@/components/VoiceCall';

interface VideoCallProps {
  chatId: string;
  isInitiator: boolean;
  onEndCall: (outcome: CallOutcome) => void;
  participantName?: string;
  participantAvatar?: string;
}

const RING_TIMEOUT_MS = 45_000;

export const VideoCall = ({
  chatId,
  isInitiator,
  onEndCall,
  participantName = 'User',
  participantAvatar,
}: VideoCallProps) => {
  const { user } = useAuth();
  const { client, error: clientError } = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);
  const [minimized, setMinimized] = useState(false);
  const callId = useMemo(() => callIdForChat(chatId, 'video'), [chatId]);

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
    const c = client.call('default', callId);
    (async () => {
      try {
        await c.join({ create: true });
        await c.camera.enable();
        await c.microphone.enable();
        if (!cancelled) setCall(c);
      } catch (e) {
        console.error('[VideoCall] join failed', e);
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

  useEffect(() => {
    if (!isInitiator || !user) return;

    // Notifies the other participant via IncomingCallOverlay (which
    // listens on call_signals) that a call is coming in. This was missing
    // entirely -- Stream connected the call on its own servers but nothing
    // ever told the other person's app a call was happening.
    supabase.from('call_signals').insert({
      call_id: chatId,
      sender_id: user.id,
      signal_type: 'offer',
      signal_data: { video: true },
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
        kind="video"
        participantName={participantName}
        participantAvatar={participantAvatar}
        statusText={isInitiator ? 'Starting video…' : 'Joining video…'}
        minimized={minimized}
        onMinimize={() => setMinimized(true)}
        onRestore={() => setMinimized(false)}
        onEnd={end}
        remoteVideo={
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        }
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
        <VideoCallInner
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

const VideoCallInner = ({
  onEnd,
  minimized,
  setMinimized,
  participantName,
  participantAvatar,
  hasConnectedRef,
  durationRef,
}: InnerProps) => {
  const { useCallCallingState, useCameraState, useMicrophoneState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { camera, isMute: camMute } = useCameraState();
  const { microphone, isMute: micMute } = useMicrophoneState();
  const participants = useParticipants();
  const remoteParticipants = participants.filter((p) => !p.isLocalParticipant);

  const [duration, setDuration] = useState(0);
  // Only "connected" once the other person has actually joined — not just
  // because we ourselves reached the JOINED state waiting alone.
  const connected = callingState === CallingState.JOINED && remoteParticipants.length > 0;

  useEffect(() => {
    if (connected) hasConnectedRef.current = true;
  }, [connected, hasConnectedRef]);

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setDuration((d) => {
      durationRef.current = d + 1;
      return d + 1;
    }), 1000);
    return () => clearInterval(id);
  }, [connected, durationRef]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  };

  const toggleCam = () => {
    haptic('light');
    camera.toggle();
  };
  const toggleMic = () => {
    haptic('light');
    microphone.toggle();
  };
  const flipCam = async () => {
    haptic('light');
    try {
      await camera.flip();
    } catch {
      /* unsupported on desktop */
    }
  };

  const statusText = connected ? formatDuration(duration) : 'Connecting…';

  const controls = (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      <Button
        size="icon"
        variant="secondary"
        onClick={flipCam}
        className="h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 text-white border-0 touch-manipulation"
        aria-label="Flip camera"
      >
        <RefreshCw className="h-5 w-5" />
      </Button>
      <Button
        size="icon"
        variant="secondary"
        onClick={toggleCam}
        className="h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 text-white border-0 touch-manipulation"
        aria-label={!camMute ? 'Turn off camera' : 'Turn on camera'}
      >
        {!camMute ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </Button>
      <Button
        size="icon"
        variant="secondary"
        onClick={toggleMic}
        className="h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 text-white border-0 touch-manipulation"
        aria-label={!micMute ? 'Mute' : 'Unmute'}
      >
        {!micMute ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
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
      kind="video"
      participantName={participantName}
      participantAvatar={participantAvatar}
      statusText={statusText}
      minimized={minimized}
      onMinimize={() => setMinimized(true)}
      onRestore={() => setMinimized(false)}
      onEnd={onEnd}
      remoteVideo={
        connected ? (
          <SpeakerLayout participantsBarPosition="bottom" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )
      }
      autoHideControls
      controls={controls}
    />
  );
};

export default VideoCall;