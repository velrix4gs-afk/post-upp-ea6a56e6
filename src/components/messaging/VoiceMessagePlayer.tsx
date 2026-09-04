import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  isOwn?: boolean;
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

export const VoiceMessagePlayer = ({ audioUrl, isOwn, className }: VoiceMessagePlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>(() => Array(BAR_COUNT).fill(0.25));
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
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

  const seekFromEvent = (clientX: number) => {
    const audio = audioRef.current;
    const el = waveRef.current;
    if (!audio || !el || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const playedBars = Math.round(progress * peaks.length);

  return (
    <div className={cn("flex items-center gap-2 p-1.5 rounded-lg min-w-[210px]", className)}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
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
          onClick={(e) => seekFromEvent(e.clientX)}
          className="flex items-center gap-[2px] h-8 cursor-pointer touch-manipulation"
        >
          {peaks.map((peak, i) => {
            // Continuous (pixel-by-pixel) fill instead of crude per-bar stepping
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
                  opacity: 0.4 + fill * 0.6,
                  transition: 'opacity 90ms linear',
                }}
              />
            );
          })}
        </div>
        <div className="text-[11px] opacity-70 mt-0.5">
          {formatTime(isPlaying || currentTime > 0 ? currentTime : duration)}
        </div>
      </div>
    </div>
  );
};
