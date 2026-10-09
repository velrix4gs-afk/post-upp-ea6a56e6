import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Video, Loader2 } from 'lucide-react';
import {
  StreamVideo,
  StreamCall,
  ParticipantsAudio,
  useCallStateHooks,
  useCall,
  type Call,
  CallingState,
} from '@stream-io/video-react-sdk';
import { useStreamVideoClient, callIdForChat, describeStreamCallError } from '@/hooks/useStreamVideoClient';
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

interface CallSignalRow {
  id: string;
  call_id: string;
  sender_id: string;
  signal_type: string;
}

export const VoiceCall = ({
  chatId,
  isInitiator,
  onEndCall,
  participantName = 'User',
  participantAvatar,
}: VoiceCallProps) => {
  const { user } = useAuth();
  const { client, error: clientError, retry: retryStreamClient } = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [signalError, setSignalError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  // Speaker state for the pre-connect screen. The inner component owns its own
  // copy once the call is live; this one only covers ringing/connecting.
  const [speakerOn, setSpeakerOn] = useState(true);
  const callId = useMemo(() => callIdForChat(chatId, 'voice'), [chatId]);

  const hasConnectedRef = useRef(false);
  const durationRef = useRef(0);
  const endedRef = useRef(false);
  const signaledCallRef = useRef<string | null>(null);

  const finish = (status: CallOutcome['status']) => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEndCall({ status, durationSec: durationRef.current });
  };

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    // 'default' lets both people talk immediately; 'audio_room' starts in
    // backstage mode, so the person answering could never be heard.
    const c = client.call('default', callId);
    (async () => {
      try {
        await c.join({ create: true });
        await c.microphone.enable();
        await c.camera.disable();
        if (!cancelled) setCall(c);
      } catch (e) {
        console.error('[VoiceCall] join failed', e);
        if (!cancelled) {
          setCallError(describeStreamCallError(e, 'join the voice call'));
        }
      }
    })();
    return () => {
      cancelled = true;
      c.microphone.disable().catch(() => { });
      c.leave().catch(() => { });
    };

    // Subscribe before publishing the offer so a quick decline cannot be lost
    // between sending the invite and attaching the outcome listener.
    useEffect(() => {
      if (!isInitiator || !user || !call) return;

      const signalKey = `${user.id}:${chatId}:${callId}`;
      let cancelled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const channel = supabase
        .channel(`call-outcome-${chatId}-${callId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'call_signals' },
          (payload) => {
            const signal = payload.new as CallSignalRow;
            if (signal.call_id !== chatId || signal.sender_id === user.id) return;
            if (signal.signal_type === 'decline' && !hasConnectedRef.current) {
              finish('declined');
            }
          },
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === 'SUBSCRIBED' && signaledCallRef.current !== signalKey) {
            signaledCallRef.current = signalKey;
            void supabase.from('call_signals').insert({
              call_id: chatId,
              sender_id: user.id,
              signal_type: 'offer',
              signal_data: { video: false },
            }).then(({ error }) => {
              if (cancelled) return;
              if (error) {
                signaledCallRef.current = null;
                setSignalError('Could not notify the other person. Check that the call migrations are deployed, then retry.');
                console.error('[VoiceCall] failed to send call offer', error);
                return;
              }
              setSignalError(null);
              timeout = setTimeout(() => {
                if (!hasConnectedRef.current) {
                  void supabase.from('call_signals').insert({
                    call_id: chatId,
                    sender_id: user.id,
                    signal_type: 'cancel',
                    signal_data: {},
                  }).then(({ error: cancelError }) => {
                    if (cancelError) {
                      setSignalError('The call could not be cancelled for the other person.');
                      console.error('[VoiceCall] failed to cancel timed-out call', cancelError);
                    }
                  });
                  finish('unanswered');
                }
              }, RING_TIMEOUT_MS);
            });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setSignalError('Could not connect to call signaling. Check your connection and retry.');
          }
        });

      return () => {
        cancelled = true;
        supabase.removeChannel(channel);
        if (timeout) clearTimeout(timeout);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInitiator, user, chatId, callId, call, retryCount]);

    const retry = () => {
      setCallError(null);
      setSignalError(null);
      setCall(null);
      setRetryCount((count) => count + 1);
      retryStreamClient();
    };

    const end = () => {
      haptic('heavy');
      const connected = hasConnectedRef.current;
      if (!connected && user) {
        void supabase.from('call_signals').insert({
          call_id: chatId,
          sender_id: user.id,
          signal_type: isInitiator ? 'cancel' : 'decline',
          signal_data: {},
        }).then(({ error }) => {
          if (error) console.error('[VoiceCall] failed to end pending call', error);
        });
      }
      finish(connected ? 'completed' : isInitiator ? 'unanswered' : 'declined');
    };

    if (!client || !call) {
      return (
        <CallShell
          kind="voice"
          participantName={participantName}
          participantAvatar={participantAvatar}
          statusText={callError || signalError || clientError ? 'Call could not start' : isInitiator ? 'Calling…' : 'Connecting…'}
          minimized={minimized}
          onMinimize={() => setMinimized(true)}
          onRestore={() => setMinimized(false)}
          onEnd={end}
          setupError={clientError?.message || callError || signalError || undefined}
          onRetry={retry}
          controls={
            <div className="flex items-center justify-center gap-4 sm:gap-6">
              {/* Speaker toggle while ringing / connecting.
                The active-call controls already have one, but they only mount
                once Stream connects — so during the connecting screen there
                was no way to change the output. Stream's call object is not
                available this early, so this mutes the rendered audio elements
                directly, which is the same mechanism the active toggle uses. */}
              <Button
                size="icon"
                variant="secondary"
                onClick={() => {
                  haptic('light');
                  setSpeakerOn((on) => {
                    const next = !on;
                    document.querySelectorAll('audio').forEach((el) => {
                      (el as HTMLAudioElement).muted = !next;
                    });
                    return next;
                  });
                }}
                className="h-14 w-14 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white touch-manipulation"
                aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}
              >
                {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </Button>
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
            isInitiator={isInitiator}
            hasConnectedRef={hasConnectedRef}
            durationRef={durationRef}
            setupError={signalError || undefined}
            onRetry={retry}
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
    isInitiator: boolean;
    hasConnectedRef: React.MutableRefObject<boolean>;
    durationRef: React.MutableRefObject<number>;
    setupError?: string;
    onRetry: () => void;
  }

  const VoiceCallInner = ({
    onEnd,
    minimized,
    setMinimized,
    participantName,
    participantAvatar,
    isInitiator,
    hasConnectedRef,
    durationRef,
    setupError,
    onRetry,
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

    const activeCall = useCall();
    const toggleSpeaker = () => {
      haptic('light');
      const next = !speakerOn;
      setSpeakerOn(next);
      try {
        activeCall?.speaker.setVolume(next ? 1 : 0);
      } catch (error) {
        console.error('[VoiceCall] could not change speaker volume', error);
      }
      document.querySelectorAll('audio').forEach((el) => {
        (el as HTMLAudioElement).muted = !next;
      });
    };

    const statusText = isConnected
      ? formatDuration(callDuration)
      : isInitiator && callingState === CallingState.JOINED
        ? 'Ringing…'
        : 'Connecting…';

    const controls = (
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <Button
          size="icon"
          variant="secondary"
          onClick={toggleSpeaker}
          className="h-14 w-14 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white touch-manipulation"
          aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}
        >
          {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={toggleMic}
          className={`h-14 w-14 rounded-full touch-manipulation ${isMute ? 'bg-red-600 text-white hover:bg-red-700 hover:text-white' : 'border border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white'}`}
          aria-label={!isMute ? 'Mute' : 'Unmute'}
        >
          {!isMute ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
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
        setupError={setupError}
        onRetry={onRetry}
      />
    );
  };

  export default VoiceCall;