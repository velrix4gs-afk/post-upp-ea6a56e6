import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  isSending?: boolean;
}

const VoiceRecorder = ({ onSend, onCancel, isSending = false }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const shouldSendOnStopRef = useRef(false);
  const durationOnStopRef = useRef(0);
  const hasSentRef = useRef(false);
  const BAR_COUNT = 28;
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0.15));

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    try { mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : undefined;
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        try {
          const blob = new Blob(chunksRef.current, {
            type: mediaRecorder.mimeType || 'audio/webm',
          });
          setAudioBlob(blob);
          stream.getTracks().forEach(track => track.stop());
          if (shouldSendOnStopRef.current) {
            shouldSendOnStopRef.current = false;
            if ((blob.size > 0 || chunksRef.current.length > 0) && !isSending && !hasSentRef.current) {
              hasSentRef.current = true;
              onSend(blob, durationOnStopRef.current || 1);
            } else {
              // Only warn on genuinely-empty recordings (no chunks AND no duration).
              if (chunksRef.current.length === 0 && (durationOnStopRef.current || 0) < 1) {
                toast({
                  title: 'Recording too short',
                  description: 'Hold to record a longer voice note.',
                  variant: 'destructive',
                });
              }
            }
          }
        } catch (err) {
          console.error('[VoiceRecorder] onstop error', err);
        }
      };

      // Use a timeslice so ondataavailable fires periodically — some browsers
      // otherwise emit an empty buffer when stop() is called quickly after start().
      mediaRecorder.start(250);
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Real waveform via AnalyserNode
      try {
        const Ctx: typeof AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.75;
          source.connect(analyser);
          analyserRef.current = analyser;
          const data = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(data);
            const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
            const next: number[] = [];
            for (let i = 0; i < BAR_COUNT; i++) {
              let sum = 0;
              for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
              const avg = sum / step / 255;
              next.push(Math.max(0.12, Math.min(1, avg * 1.4)));
            }
            setLevels(next);
            rafRef.current = requestAnimationFrame(tick);
          };
          tick();
        }
      } catch {
        // Waveform is a nice-to-have; recording continues without it.
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not access microphone',
        variant: 'destructive'
      });
      onCancel();
    }
  };

  const stopRecording = (thenSend = false) => {
    if (isSending) return;
    if (thenSend) {
      shouldSendOnStopRef.current = true;
      durationOnStopRef.current = duration;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      // Flush final chunk before stopping so onstop sees a non-empty blob.
      try { mediaRecorderRef.current.requestData(); } catch {}
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const handleSend = () => {
    if (isSending) return;
    if (audioBlob) {
      if (hasSentRef.current) return;
      hasSentRef.current = true;
      onSend(audioBlob, duration);
      return;
    }
    // Still recording — stop and send in one tap.
    if (isRecording) {
      stopRecording(true);
    }
  };

  const handleDelete = () => {
    if (isSending) return;
    stopRecording(false);
    onCancel();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 p-4 bg-destructive/10 border-t">
      <Button
        size="icon"
        variant="ghost"
        onClick={handleDelete}
        disabled={isSending}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-5 w-5" />
      </Button>

      <div className="flex-1 flex items-center gap-3">
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
          isRecording ? "bg-destructive animate-pulse" : "bg-muted"
        )}>
          <Mic className={cn(
            "h-5 w-5",
            isRecording ? "text-white" : "text-muted-foreground"
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-10 bg-primary/10 rounded-full flex items-center justify-center px-3 overflow-hidden">
              <div className="flex gap-[3px] items-center h-full w-full justify-center">
                {levels.map((lvl, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-primary origin-center transition-transform duration-75 ease-out"
                    style={{ height: '70%', transform: `scaleY(${isRecording ? lvl : 0.2})` }}
                  />
                ))}
              </div>
            </div>
            <span className="text-sm font-mono font-semibold tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
        </div>
      </div>

      <Button
        size="icon"
        onClick={handleSend}
        disabled={isSending || (!audioBlob && !isRecording)}
        className="bg-primary hover:bg-primary/90"
        aria-label="Send voice message"
      >
        {isSending ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
};

export default VoiceRecorder;
