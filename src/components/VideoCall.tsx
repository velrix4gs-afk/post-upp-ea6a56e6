import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

interface VideoCallProps {
  chatId: string;
  isInitiator: boolean;
  onEndCall: () => void;
}

export const VideoCall = ({ chatId, isInitiator, onEndCall }: VideoCallProps) => {
  const { toast } = useToast();
  const { client, error: clientError } = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);
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
        toast({
          title: 'Call Error',
          description: 'Failed to start video call',
          variant: 'destructive',
        });
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
    if (clientError) {
      toast({ title: 'Call Error', description: clientError.message, variant: 'destructive' });
      setTimeout(onEndCall, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientError]);

  if (!client || !call) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            {isInitiator ? 'Starting video call…' : 'Joining video call…'}
          </p>
          <Button variant="destructive" onClick={onEndCall} className="rounded-full">
            <PhoneOff className="h-5 w-5 mr-2" /> Cancel
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <VideoCallInner onEndCall={onEndCall} />
      </StreamCall>
    </StreamVideo>
  );
};

const VideoCallInner = ({ onEndCall }: { onEndCall: () => void }) => {
  const { useCallCallingState, useCameraState, useMicrophoneState, useScreenShareState } =
    useCallStateHooks();
  const callingState = useCallCallingState();
  const { camera, isMute: camMute } = useCameraState();
  const { microphone, isMute: micMute } = useMicrophoneState();
  const { screenShare, isMute: screenOff } = useScreenShareState();

  const connecting = callingState !== CallingState.JOINED;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <div className="flex-1 relative bg-black str-video">
        {connecting ? (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Connecting…</span>
            </div>
          </div>
        ) : (
          <SpeakerLayout participantsBarPosition="bottom" />
        )}
      </div>

      <div className="p-4 bg-card border-t">
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            variant={!camMute ? 'default' : 'destructive'}
            onClick={() => camera.toggle()}
          >
            {!camMute ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          <Button
            size="lg"
            variant={!micMute ? 'default' : 'destructive'}
            onClick={() => microphone.toggle()}
          >
            {!micMute ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </Button>

          <Button
            size="lg"
            variant={!screenOff ? 'secondary' : 'outline'}
            onClick={() => screenShare.toggle()}
          >
            <Monitor className="h-5 w-5" />
          </Button>

          <Button size="lg" variant="destructive" onClick={onEndCall}>
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
