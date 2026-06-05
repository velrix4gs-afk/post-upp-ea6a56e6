// Mobile-responsive UI scaffolds for future call providers.
// Live calls run through Stream SDK in VoiceCall / VideoCall components —
// these placeholders document the structure for an Agora/Twilio swap.

import { Button } from '@/components/ui/button';
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2 } from 'lucide-react';
import { useState } from 'react';

interface ActiveCallScreenProps {
  remoteName?: string;
  isVideo?: boolean;
  onEnd?: () => void;
}

export function ActiveCallScreen({
  remoteName = 'Unknown',
  isVideo = true,
  onEnd,
}: ActiveCallScreenProps) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col">
      {/* Remote stream node */}
      <div className="relative flex-1 bg-muted overflow-hidden">
        <div
          data-call-node="remote-video"
          className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm"
        >
          {isVideo ? 'Remote video' : `In call with ${remoteName}`}
        </div>

        {/* Local PiP */}
        {isVideo && (
          <div
            data-call-node="local-preview"
            className="absolute top-4 right-4 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl bg-card border border-border shadow-lg flex items-center justify-center text-xs text-muted-foreground"
          >
            You
          </div>
        )}

        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-background/70 backdrop-blur text-xs">
          {remoteName}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pt-4 pb-8 flex items-center justify-center gap-4 bg-background/95 border-t border-border">
        <Button
          variant={muted ? 'destructive' : 'secondary'}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        {isVideo && (
          <Button
            variant={videoOff ? 'destructive' : 'secondary'}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={() => setVideoOff((v) => !v)}
            aria-label={videoOff ? 'Start video' : 'Stop video'}
          >
            {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </Button>
        )}
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-12 rounded-full"
          aria-label="Speaker"
        >
          <Volume2 className="h-5 w-5" />
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="h-14 w-14 rounded-full"
          onClick={onEnd}
          aria-label="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

interface IncomingCallToastProps {
  callerName: string;
  kind?: 'voice' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallToast({
  callerName,
  kind = 'voice',
  onAccept,
  onDecline,
}: IncomingCallToastProps) {
  return (
    <div
      role="alertdialog"
      aria-label={`Incoming ${kind} call from ${callerName}`}
      className="fixed top-4 inset-x-4 z-[100] mx-auto max-w-md rounded-2xl border border-border bg-card/95 backdrop-blur shadow-2xl p-4 flex items-center gap-3 touch-manipulation"
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Incoming {kind} call
        </div>
        <div className="text-base font-semibold truncate">{callerName}</div>
      </div>
      <Button variant="destructive" size="sm" onClick={onDecline}>
        Decline
      </Button>
      <Button size="sm" onClick={onAccept}>
        Accept
      </Button>
    </div>
  );
}
