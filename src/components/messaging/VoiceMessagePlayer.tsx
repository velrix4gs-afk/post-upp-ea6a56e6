import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Mic } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  isOwn?: boolean;
  /** Sender avatar shown at the end of the bubble with a mic badge, like WhatsApp. */
  avatarUrl?: string | null;
  fallbackName?: string;
  className?: string;
}

const BAR_COUNT = 40;
const peaksCache = new Map<string, number[]>();

/** Decode the actual audio blob and reduce it to normalized peak bars. */
const buildPeaks = async (url: string): Promise<number[]> => {
  const cached = peaksCache.get(url);
  if (cached) return cached;

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const Ctx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const raw = buffer.getChannelData(0);
    const blockSize = Math.floor(raw.length / BAR_COUNT) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(raw[i * blockSize + j] || 0);
      }
      peaks.push(sum / blockSize);
    }
    const max = Math.max(...peaks, 0.0001);
    const normalized = peaks.map((p) => Math.max(0.12, Math.min(1, p / max)));
    peaksCache.set(url, normalized);
    return normalized;
  } finally {
    try { await ctx.close(); } catch { /* ignore */ }
  }
};

export const VoiceMessagePlayer = ({ audioUrl, isOwn, avatarUrl, fallbackName, className }: VoiceMessagePlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrubRatio, setScrubRatio] = useState<number | null>(null);
  const scrubRatioRef = useRef<number | null>(null);
  const [peaks, setPeaks] = useState<number[]>(() => Array(BAR_COUNT).fill(0.25));
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const fixingDurationRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      if (fixingDurationRef.current) { updateDuration(); return; }
      setCurrentTime(audio.currentTime);
    };
    const applyPendingSeek = () => {
      if (pendingSeekRef.current !== null && isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = pendingSeekRef.current * audio.duration;
        pendingSeekRef.current = null;
      }
    };
    const updateDuration = () => {
      if (audio.duration === Infinity && !fixingDurationRef.current) {
        // Recorded WebM voice notes report Infinity until the end is reached once; jump there to learn the real length.
        fixingDurationRef.current = true;
        audio.currentTime = 1e101;
        return;
      }
      if (isFinite(audio.duration)) {
        setDuration(audio.duration);
        if (fixingDurationRef.current) {
          fixingDurationRef.current = false;
          audio.currentTime = 0;
        }
        applyPendingSeek();
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Build the real waveform from the recorded audio (WhatsApp style).
  useEffect(() => {
    let cancelled = false;
    buildPeaks(audioUrl)
      .then((p) => {
        if (!cancelled) setPeaks(p);
      })
      .catch(() => {
        /* keep the flat placeholder waveform */
      });
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const ratioFromX = (clientX: number) => {
    const el = waveRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  // Draggable scrubber: preview while dragging, commit the seek on release.
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = ratioFromX(e.clientX);
    scrubRatioRef.current = r;
    setScrubRatio(r);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubRatioRef.current === null) return;
    const r = ratioFromX(e.clientX);
    scrubRatioRef.current = r;
    setScrubRatio(r);
  };
  const endScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = scrubRatioRef.current;
    scrubRatioRef.current = null;
    setScrubRatio(null);
    const audio = audioRef.current;
    if (r === null || !audio) return;
    if (!duration || !isFinite(audio.duration)) {
      // Metadata not ready yet: remember the target and apply it as soon as the length is known.
      pendingSeekRef.current = r;
      audio.load();
      setCurrentTime(0);
      return;
    }
    audio.currentTime = r * duration;
    setCurrentTime(audio.currentTime);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = scrubRatio !== null ? scrubRatio : duration > 0 ? currentTime / duration : 0;
  const shownTime = scrubRatio !== null ? scrubRatio * duration : currentTime;

  return (
    <div className={cn("flex items-center gap-2.5 min-w-[220px] select-none", className)} onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={audioUrl} preload="auto" />
      
      <Button
        size="icon"
        variant="ghost"
        onClick={togglePlayPause}
        className={cn(
          "h-9 w-9 rounded-full flex-shrink-0",
          isOwn ? "hover:bg-primary-foreground/10" : "hover:bg-foreground/10"
        )}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 fill-current" />
        ) : (
          <Play className="h-5 w-5 fill-current" />
        )}
      </Button>

      <div className="flex-1 min-w-0">
        <div
          ref={waveRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          role="slider"
          aria-label="Voice message position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(shownTime)}
          style={{ touchAction: 'none' }}
          className="relative flex items-center gap-[2px] h-8 cursor-pointer"
        >
          {peaks.map((peak, i) => {
            const fill = Math.max(0, Math.min(1, progress * peaks.length - i));
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 min-w-[2px] rounded-full",
                  isOwn ? "bg-current" : "bg-primary"
                )}
                style={{
                  height: `${Math.max(12, peak * 100)}%`,
                  opacity: 0.35 + fill * 0.65,
                }}
              />
            );
          })}
          {/* Scrubber knob */}
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow",
              isOwn ? "bg-current" : "bg-primary",
              scrubRatio !== null && "scale-125"
            )}
            style={{ left: `${progress * 100}%` }}
          />
        </div>
        <div className="mt-0.5 flex justify-between text-[11px] tabular-nums opacity-70">
          <span>{formatTime(isPlaying || shownTime > 0 ? shownTime : duration)}</span>
          {(isPlaying || shownTime > 0) && <span>{formatTime(duration)}</span>}
        </div>
      </div>

      {(avatarUrl || fallbackName) && (
        <div className="relative ml-1 flex-shrink-0">
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback>{(fallbackName || '?').charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Mic className="absolute -bottom-0.5 -right-1 h-5 w-5 fill-current text-primary drop-shadow" />
        </div>
      )}
    </div>
  );
};
