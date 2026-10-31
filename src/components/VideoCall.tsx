import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff, RefreshCw, Loader2, Volume2, VolumeX } from 'lucide-react';
import { StreamVideo, StreamCall, ParticipantView, useCallStateHooks, useCall, type Call, CallingState } from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { useStreamVideoClient, callIdForChat, describeStreamCallError } from '@/hooks/useStreamVideoClient';
import { CallShell } from '@/components/calls/CallShell';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { CallOutcome } from '@/components/VoiceCall';

interface VideoCallProps { chatId: string; isInitiator: boolean; onEndCall: (outcome: CallOutcome) => void; participantName?: string; participantAvatar?: string; }
const RING_TIMEOUT_MS = 45_000;
interface CallSignalRow { id: string; call_id: string; sender_id: string; signal_type: string; }

export const VideoCall = ({ chatId, isInitiator, onEndCall, participantName = 'User', participantAvatar }: VideoCallProps) => {
  const { user } = useAuth();
  const { client, error: clientError, retry: retryStreamClient } = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [signalError, setSignalError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const callId = useMemo(() => callIdForChat(chatId, 'video'), [chatId]);

  const hasConnectedRef = useRef(false);
  const durationRef = useRef(0);
  const endedRef = useRef(false);
  const signaledCallRef = useRef<string | null>(null);

  const finish = (status: CallOutcome['status']) => { if (endedRef.current) return; endedRef.current = true; onEndCall({ status, durationSec: durationRef.current }); };

  useEffect(() => {
    if (!user) return;
    const endChannel = supabase.channel(`call-end-${chatId}-${callId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals' }, (payload) => {
      const s = payload.new as CallSignalRow;
      if (s.call_id !== chatId || s.sender_id === user.id) return;
      if (s.signal_type === 'end' && hasConnectedRef.current) finish('completed');
      if (s.signal_type === 'cancel' && !isInitiator && !hasConnectedRef.current) finish('declined');
    }).subscribe();
    return () => { supabase.removeChannel(endChannel); };
  }, [user, chatId, callId, isInitiator]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const c = client.call('default', callId);
    (async () => {
      try {
        await c.join({ create: true });
        if (cancelled) throw new Error('cancelled');
        await c.camera.enable();
        await c.microphone.enable();
        if (cancelled) throw new Error('cancelled');
        setCall(c);
      } catch (e) {
        if (cancelled) { c.camera.disable(true).catch(() => { }); c.microphone.disable(true).catch(() => { }); c.leave().catch(() => { }); return; }
        setCallError(describeStreamCallError(e, 'join the video chat'));
      }
    })();
    return () => { cancelled = true; c.camera.disable(true).catch(() => { }); c.microphone.disable(true).catch(() => { }); c.leave().catch(() => { }); };
  }, [callId, client]);

  useEffect(() => {
    if (!isInitiator || !user || !call) return;
    const signalKey = `${user.id}:${chatId}:${callId}`;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel(`call-outcome-${chatId}-${callId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals' }, (payload) => {
      const signal = payload.new as CallSignalRow;
      if (signal.call_id !== chatId || signal.sender_id === user.id) return;
      if (signal.signal_type === 'decline' && !hasConnectedRef.current) finish('declined');
    }).subscribe((status) => {
      if (cancelled) return;
      if (status === 'SUBSCRIBED' && signaledCallRef.current !== signalKey) {
        signaledCallRef.current = signalKey;
        void supabase.from('call_signals').insert({ call_id: chatId, sender_id: user.id, signal_type: 'offer', signal_data: { video: true } }).then(({ error }) => {
          if (cancelled) return;
          if (error) { signaledCallRef.current = null; setSignalError('Could not notify the other person.'); return; }
          setSignalError(null);
          timeout = setTimeout(() => {
            if (!hasConnectedRef.current) {
              void supabase.from('call_signals').insert({ call_id: chatId, sender_id: user.id, signal_type: 'cancel', signal_data: {} });
              finish('unanswered');
            }
          }, RING_TIMEOUT_MS);
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { setSignalError('Could not connect.'); }
    });
    return () => { cancelled = true; supabase.removeChannel(channel); if (timeout) clearTimeout(timeout); };
  }, [isInitiator, user, chatId, callId, call, retryCount]);

  const retry = () => { setCallError(null); setSignalError(null); setCall(null); setRetryCount(c => c + 1); retryStreamClient(); };
  const end = () => {
    haptic('heavy');
    const connected = hasConnectedRef.current;
    if (!connected && user) void supabase.from('call_signals').insert({ call_id: chatId, sender_id: user.id, signal_type: isInitiator ? 'cancel' : 'decline', signal_data: {} });
    if (connected && user) void supabase.from('call_signals').insert({ call_id: chatId, sender_id: user.id, signal_type: 'end', signal_data: {} });
    finish(connected ? 'completed' : isInitiator ? 'unanswered' : 'declined');
  };

  if (!client || !call) {
    return (
       <CallShell kind="video" participantName={participantName} participantAvatar={participantAvatar} statusText={callError || signalError || clientError ? 'Chat could not start' : isInitiator ? 'Starting video…' : 'Joining video…'} minimized={minimized} onMinimize={() => setMinimized(true)} onRestore={() => setMinimized(false)} onEnd={end} setupError={clientError?.message || callError || signalError || undefined} onRetry={retry} remoteVideo={<div className="absolute inset-0 flex items-center justify-center text-white/80"><Loader2 className="h-6 w-6 animate-spin" /></div>} controls={
         <div className="flex items-center justify-center gap-3 sm:gap-4">
           <Button size="icon" variant="secondary" onClick={() => { haptic('light'); setSpeakerOn(on => !on); }} className="h-12 w-12 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/20 touch-manipulation" aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}>
             {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
           </Button>
           <Button size="icon" variant="destructive" onClick={end} className="h-14 w-14 rounded-full shadow-lg touch-manipulation" aria-label="Cancel chat"><PhoneOff className="h-6 w-6" /></Button>
         </div>
       } />
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <VideoCallInner onEnd={end} minimized={minimized} setMinimized={setMinimized} participantName={participantName} participantAvatar={participantAvatar} isInitiator={isInitiator} hasConnectedRef={hasConnectedRef} durationRef={durationRef} setupError={signalError || undefined} onRetry={retry} />
      </StreamCall>
    </StreamVideo>
  );
};

interface InnerProps { onEnd: () => void; minimized: boolean; setMinimized: (v: boolean) => void; participantName: string; participantAvatar?: string; isInitiator: boolean; hasConnectedRef: React.MutableRefObject<boolean>; durationRef: React.MutableRefObject<number>; setupError?: string; onRetry: () => void; }

const VideoCallInner = ({ onEnd, minimized, setMinimized, participantName, participantAvatar, isInitiator, hasConnectedRef, durationRef, setupError, onRetry }: InnerProps) => {
  const { useCallCallingState, useCameraState, useMicrophoneState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { camera, isMute: camMute } = useCameraState();
  const { microphone, isMute: micMute } = useMicrophoneState();
  const participants = useParticipants();
  const remoteParticipants = participants.filter(p => !p.isLocalParticipant);
  const [duration, setDuration] = useState(0);
  const connected = callingState === CallingState.JOINED && remoteParticipants.length > 0;

  useEffect(() => { if (connected) hasConnectedRef.current = true; }, [connected, hasConnectedRef]);
  useEffect(() => { if (!connected) return; const id = setInterval(() => setDuration(d => { durationRef.current = d + 1; return d + 1; }), 1000); return () => clearInterval(id); }, [connected, durationRef]);

  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const toggleCam = () => { haptic('light'); camera.toggle(); };
  const toggleMic = () => { haptic('light'); microphone.toggle(); };
  const flipCam = async () => { haptic('light'); try { await camera.flip(); } catch { /* unsupported */ } };

  const activeCall = useCall();
  const [speakerOn, setSpeakerOn] = useState(true);

  // FIXED: Toggle speaker without muting the entire device/mic
  const toggleSpeaker = () => {
    haptic('light');
    const next = !speakerOn;
    setSpeakerOn(next);
    try {
      activeCall?.speaker.setVolume(next ? 1 : 0);
    } catch (error) {
      console.error('[VideoCall] could not change speaker volume', error);
    }
  };

  const statusText = connected ? formatDuration(duration) : 'Connecting…';

  const controls = (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      <Button size="icon" variant="secondary" onClick={flipCam} className="h-11 w-11 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/20 touch-manipulation"><RefreshCw className="h-4 w-4" /></Button>
      <Button size="icon" variant="secondary" onClick={toggleSpeaker} className="h-11 w-11 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/20 touch-manipulation" aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}>
        {speakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </Button>
      <Button size="icon" variant="secondary" onClick={toggleCam} className="h-11 w-11 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/20 touch-manipulation">
        {!camMute ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
      </Button>
      <Button size="icon" variant="secondary" onClick={toggleMic} className={`h-11 w-11 rounded-full touch-manipulation ${micMute ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-white/10 bg-white/10 text-white hover:bg-white/20'}`}>
        {!micMute ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
      </Button>
      <Button size="icon" variant="destructive" onClick={onEnd} className="h-13 w-13 rounded-full shadow-lg touch-manipulation"><PhoneOff className="h-5 w-5" /></Button>
    </div>
  );

  return (
    <CallShell kind="video" participantName={participantName} participantAvatar={participantAvatar} statusText={connected ? statusText : isInitiator ? 'Ringing…' : 'Connecting…'} minimized={minimized} onMinimize={() => setMinimized(true)} onRestore={() => setMinimized(false)} onEnd={onEnd} remoteVideo={connected ? <ParticipantView participant={remoteParticipants[0]} ParticipantViewUI={null} className="h-full w-full" /> : <div className="absolute inset-0 flex items-center justify-center text-white/80"><Loader2 className="h-6 w-6 animate-spin" /></div>} autoHideControls controls={controls} setupError={setupError} onRetry={onRetry} />
  );
};

export default VideoCall;