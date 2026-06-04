import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  StreamVideo,
  StreamCall,
  ParticipantsAudio,
  useCallStateHooks,
  type Call,
  CallingState,
} from '@stream-io/video-react-sdk';
import { useStreamVideoClient, callIdForChat } from '@/hooks/useStreamVideoClient';

interface VoiceCallProps {
  chatId: string;
  isInitiator: boolean;
  onEndCall: () => void;
  participantName?: string;
  participantAvatar?: string;
}

export const VoiceCall = ({
  chatId,
  isInitiator,
  onEndCall,
  participantName = 'User',
  participantAvatar,
}: VoiceCallProps) => {
  const { toast } = useToast();
  const { client, error: clientError } = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);

  const callId = useMemo(() => callIdForChat(chatId, 'voice'), [chatId]);

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
        toast({
          title: 'Call Error',
          description: 'Failed to start voice call',
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
      toast({
        title: 'Call Error',
        description: clientError.message,
        variant: 'destructive',
      });
      setTimeout(onEndCall, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientError]);

  if (!client || !call) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <Avatar className="h-24 w-24 mx-auto ring-4 ring-primary/20">
            <AvatarImage src={participantAvatar} />
            <AvatarFallback>{participantName[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-semibold">{participantName}</h2>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isInitiator ? 'Calling…' : 'Connecting…'}</span>
          </div>
          <Button
            size="lg"
            variant="destructive"
            onClick={onEndCall}
            className="h-14 w-14 rounded-full mx-auto"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <VoiceCallInner
          onEndCall={onEndCall}
          participantName={participantName}
          participantAvatar={participantAvatar}
        />
      </StreamCall>
    </StreamVideo>
  );
};

interface InnerProps {
  onEndCall: () => void;
  participantName: string;
  participantAvatar?: string;
}

const VoiceCallInner = ({ onEndCall, participantName, participantAvatar }: InnerProps) => {
  const { useCallCallingState, useMicrophoneState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { microphone, isMute } = useMicrophoneState();
  const participants = useParticipants();
  const remoteParticipants = participants.filter((p) => !p.isLocalParticipant);

  const [callDuration, setCallDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const isConnected = callingState === CallingState.JOINED && remoteParticipants.length > 0;

  useEffect(() => {
    if (!isConnected) return;
    const id = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [isConnected]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  };

  const toggleMic = async () => {
    await microphone.toggle();
  };

  const toggleSpeaker = () => {
    setSpeakerOn((v) => !v);
    // Mute remote audio elements by toggling participant audio sink
    document.querySelectorAll('audio[data-stream-audio]').forEach((el) => {
      (el as HTMLAudioElement).muted = speakerOn; // about to flip
    });
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-4">
      {/* Stream renders hidden audio sinks for remote participants */}
      <ParticipantsAudio participants={remoteParticipants} />

      <Card className="w-full max-w-md p-8 space-y-8 bg-gradient-to-br from-primary/5 to-accent/5">
        <div className="text-center space-y-4">
          <Avatar className="h-32 w-32 mx-auto ring-4 ring-primary/20">
            <AvatarImage src={participantAvatar} />
            <AvatarFallback className="text-4xl bg-primary/10">
              {participantName[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-semibold">{participantName}</h2>
            <p className="text-muted-foreground mt-1">
              {isConnected ? formatDuration(callDuration) : 'Calling…'}
            </p>
          </div>
        </div>

        {isConnected && (
          <div className="flex justify-center gap-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-8 bg-primary rounded-full animate-pulse"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}

        <div className="flex justify-center gap-6">
          <Button
            size="lg"
            variant={!isMute ? 'default' : 'destructive'}
            onClick={toggleMic}
            className="h-16 w-16 rounded-full"
          >
            {!isMute ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>

          <Button
            size="lg"
            variant={speakerOn ? 'default' : 'secondary'}
            onClick={toggleSpeaker}
            className="h-16 w-16 rounded-full"
          >
            {speakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </Button>

          <Button
            size="lg"
            variant="destructive"
            onClick={onEndCall}
            className="h-16 w-16 rounded-full"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </Card>
    </div>
  );
};
