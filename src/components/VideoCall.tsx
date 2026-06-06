import { useEffect, useMemo, useState } from 'react';
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

interface VideoCallProps {
  chatId: string;
  isInitiator: boolean;
  onEndCall: () => void;
  participantName?: string;
  participantAvatar?: string;
}

export const VideoCall = ({
  chatId,
  isInitiator,
  onEndCall,
  participantName = 'User',
  participantAvatar,
}: VideoCallProps) => {
  const { client, error: clientError } = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);
  const [minimized, setMinimized] = useState(false);
  const callId = useMemo(() => callIdForChat(chatId, 'video'), [chatId]);

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
        setTimeout(onEndCall, 1500);
      }
    })();
    return () => {
      cancelled = true;
      c.leave().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, callId]);

  useEffect(() => {
    if (clientError) setTimeout(onEndCall, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientError]);

  const end = () => {
    haptic('heavy');
    onEndCall();
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
}

const VideoCallInner = ({
  onEnd,
  minimized,
  setMinimized,
  participantName,
  participantAvatar,
}: InnerProps) => {
  const { useCallCallingState, useCameraState, useMicrophoneState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { camera, isMute: camMute } = useCameraState();
  const { microphone, isMute: micMute } = useMicrophoneState();

  const [duration, setDuration] = useState(0);
  const connected = callingState === CallingState.JOINED;

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [connected]);

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
          <SpeakerLayout participantsBarPosition={null as any} />
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