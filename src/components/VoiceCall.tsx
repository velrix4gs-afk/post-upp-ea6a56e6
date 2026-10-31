import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { StreamVideo, StreamCall, ParticipantsAudio, useCallStateHooks, useCall, type Call, CallingState } from '@stream-io/video-react-sdk';
import { useStreamVideoClient, callIdForChat, describeStreamCallError } from '@/hooks/useStreamVideoClient';
import { CallShell } from '@/components/calls/CallShell';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CallOutcome { status: 'completed' | 'declined' | 'unanswered'; durationSec: number; }
interface VoiceCallProps { chatId: string; isInitiator: boolean; onEndCall: (outcome: CallOutcome) => void; participantName?: string; participantAvatar?: string; }
const RING_TIMEOUT_MS = 45_000;
interface CallSignalRow { id: string; call_id: string; sender_id: string; signal_type: string; }

export const VoiceCall = ({ chatId, isInitiator, onEndCall, participantName = 'User', participantAvatar }: VoiceCallProps) => {
  const { user } = useAuth();
  const { client, error: clientError, retry: retryStreamClient } = useStreamVideoClient();
  const [call, setCall] = useState<Call | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [signalError, setSignalError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [isMute, setIsMute] = useState(false);
  const callId = useMemo(() => callIdForChat(chatId, 'voice'), [chatId]);

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
        await c.camera.disable(true).catch(() => { });
        await c.join({ create: true, data: { settings_override: { video: { camera_default_on: false, target_resolution: { width: 320, height: 240, bitrate: 100000 } } } } });
        if (cancelled) throw new Error('cancelled');
        await c.microphone.enable();
        await c.camera.disable(true);
        if (cancelled) throw new Error('cancelled');
        setCall(c);
      } catch (e) {
        if (cancelled) { c.microphone.disable(true).catch(() => { }); c.leave().catch(() => { }); return; }
        setCallError(describeStreamCallError(e, 'join the voice chat'));
      }
    })();
    return () => { cancelled = true; c.microphone.disable(true).catch(() => { }); c.camera.disable(true).catch(() => { }); c.leave().catch(() => { }); };
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
        void supabase.from('call_signals').insert({ call_id: chatId, sender_id: user.id, signal_type: 'offer', signal_data: { video: false } }).then(({ error }) => {
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
       <CallShell kind="voice" participantName={participantName} participantAvatar={participantAvatar} statusText={callError || signalError || clientError ? 'Chat could not start' : isInitiator ? 'Starting voice chat…' : 'Connecting…'} minimized={minimized} onMinimize={() => setMinimized(true)} onRestore={() => setMinimized(false)} onEnd={end} setupError={clientError?.message || callError || signalError || undefined} onRetry={retry} controls={
         <div className="flex items-center justify-center gap-3 sm:gap-4">
           <Button size="icon" variant="secondary" onClick={() => { haptic('light'); setSpeakerOn(on => !on); }} className="h-12 w-12 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/20 touch-manipulation" aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}>
             {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
           </Button>
           <Button size="icon" variant="secondary" onClick={() => { haptic('light'); setIsMute(on => !on); }} className={`h-12 w-12 rounded-full touch-manipulation ${isMute ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-white/10 bg-white/10 text-white hover:bg-white/20'}`} aria-label={!isMute ? 'Mute' : 'Unmute'}>
             {!isMute ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
           </Button>
           <Button size="icon" variant="destructive" onClick={end} className="h-14 w-14 rounded-full shadow-lg touch-manipulation" aria-label="Cancel chat"><PhoneOff className="h-6 w-6" /></Button>
         </div>
       } />
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <VoiceCallInner onEnd={end} minimized={minimized} setMinimized={setMinimized} participantName={participantName} participantAvatar={participantAvatar} isInitiator={isInitiator} hasConnectedRef={hasConnectedRef} durationRef={durationRef} setupError={signalError || undefined} onRetry={retry} />
      </StreamCall>
    </StreamVideo>
  );
};

interface InnerProps { onEnd: () => void; minimized: boolean; setMinimized: (v: boolean) => void; participantName: string; participantAvatar?: string; isInitiator: boolean; hasConnectedRef: React.MutableRefObject<boolean>; durationRef: React.MutableRefObject<number>; setupError?: string; onRetry: () => void; }

const VoiceCallInner = ({ onEnd, minimized, setMinimized, participantName, participantAvatar, isInitiator, hasConnectedRef, durationRef, setupError, onRetry }: InnerProps) => {
  const { useCallCallingState, useMicrophoneState, useParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const { microphone, isMute } = useMicrophoneState();
  const participants = useParticipants();
  const remoteParticipants = participants.filter(p => !p.isLocalParticipant);
  const voiceLevel = Math.max(0, ...participants.map(p => p.audioLevel ?? 0));

  const [callDuration, setCallDuration] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const isConnected = callingState === CallingState.JOINED && remoteParticipants.length > 0;

  useEffect(() => { if (isConnected) hasConnectedRef.current = true; }, [isConnected, hasConnectedRef]);
  useEffect(() => { if (!isConnected) return; const id = setInterval(() => setCallDuration(d => { durationRef.current = d + 1; return d + 1; }), 1000); return () => clearInterval(id); }, [isConnected, durationRef]);

  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const toggleMic = async () => { haptic('light'); await microphone.toggle(); };

  const activeCall = useCall();
  const toggleSpeaker = () => {
    haptic('light');
    const next = !speakerOn;
    setSpeakerOn(next);

    // FIXED: Only change the volume of the remote audio output.
    // Do not mute the whole DOM tree, which causes weird bugs with the mic.
    try {
      if (activeCall?.speaker) {
        activeCall.speaker.setVolume(next ? 1 : 0);
      }
    } catch (error) {
      console.error('[VoiceCall] could not change speaker volume', error);
    }
  };

  const statusText = isConnected ? formatDuration(callDuration) : isInitiator && callingState === CallingState.JOINED ? 'Ringing…' : 'Connecting…';

  const controls = (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      <Button size="icon" variant="secondary" onClick={toggleSpeaker} className="h-14 w-14 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white touch-manipulation" aria-label={speakerOn ? 'Speaker on' : 'Speaker off'}>
        {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </Button>
      <Button size="icon" variant="secondary" onClick={toggleMic} className={`h-14 w-14 rounded-full touch-manipulation ${isMute ? 'bg-red-600 text-white hover:bg-red-700 hover:text-white' : 'border border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white'}`} aria-label={!isMute ? 'Mute' : 'Unmute'}>
        {!isMute ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </Button>
      <Button size="icon" variant="destructive" onClick={onEnd} className="h-16 w-16 rounded-full shadow-lg touch-manipulation" aria-label="End chat"><PhoneOff className="h-6 w-6" /></Button>
    </div>
  );

  return (
    <CallShell kind="voice" participantName={participantName} participantAvatar={participantAvatar} statusText={statusText} minimized={minimized} onMinimize={() => setMinimized(true)} onRestore={() => setMinimized(false)} onEnd={onEnd} hiddenStreamMount={<ParticipantsAudio participants={remoteParticipants} />} controls={controls} setupError={setupError} onRetry={onRetry} voiceLevel={isConnected ? voiceLevel : 0} />
  );
};

export default VoiceCall;