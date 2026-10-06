import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { generateVideoThumbnail, getCachedThumbnail } from '@/lib/videoThumbnail';

interface VideoViewerProps {
  videoUrl: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  /**
   * When true the video starts playing as soon as it is in view and stops
   * when it scrolls out. Loop it too for the "keeps replaying until out of
   * focus" behaviour on the feed.
   */
  playOnFocus?: boolean;
  // 'contain' (default) letterboxes to show the full frame -- used in chat.
  // 'cover' fills and center-crops the frame -- used in the feed, where
  // post cards need a predictable, capped size regardless of the source
  // video's own aspect ratio.
  objectFit?: 'contain' | 'cover';
}

export const VideoViewer = ({
  videoUrl,
  autoPlay = false,
  muted = false,
  loop = false,
  className,
  objectFit = 'contain',
  playOnFocus = false,
}: VideoViewerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [showControls, setShowControls] = useState(true);
  // Poster frame. Seeded synchronously from cache so a returning user never
  // sees a black box, then generated once the video is actually in view.
  const [poster, setPoster] = useState<string | null>(() => getCachedThumbnail(videoUrl));

  useEffect(() => {
    setPoster(getCachedThumbnail(videoUrl));
  }, [videoUrl]);
  // Video only starts buffering once it's actually scrolled into view —
  // fixes every video in the feed silently preloading at once (heat/lag).
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        } else {
          setIsInView(false);
          // Scrolled out of view — stop buffering/playing to free up memory & battery.
          if (videoRef.current) {
            videoRef.current.pause();
          }
        }
      },
      { rootMargin: '200px', threshold: 0.25 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Autoplay is driven by visibility: start when in view, the observer above
  // already pauses on scroll-out. Applies to both the explicit autoPlay prop
  // and the feed's playOnFocus behaviour.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isInView) return;
    if (!(autoPlay || playOnFocus)) return;
    // Browsers only allow silent autoplay.
    video.muted = true;
    setIsMuted(true);
    video.play().catch(() => setIsPlaying(false));
  }, [autoPlay, playOnFocus, isInView]);

  // Generate a thumbnail once in view, but never while the video is already
  // playing — decoding a second stream would fight it for bandwidth.
  useEffect(() => {
    if (!isInView || poster || isPlaying) return;
    let cancelled = false;
    void generateVideoThumbnail(videoUrl).then((url) => {
      if (!cancelled && url) setPoster(url);
    });
    return () => {
      cancelled = true;
    };
  }, [isInView, poster, isPlaying, videoUrl]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        const v = videoRef.current;
        const p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // iOS/Safari blocks unmuted playback in some contexts — retry muted.
            try {
              v.muted = true;
              setIsMuted(true);
              v.play().catch((err) => console.warn('[VideoViewer] play failed', err));
            } catch { }
          });
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full bg-black rounded-lg overflow-hidden group", className)}
      data-media
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        // Only give the browser a src once this video has actually scrolled
        // into view — before that, nothing downloads at all.
        src={isInView ? videoUrl : undefined}
        // The poster shows before the first frame decodes, so the card is
        // never an empty black rectangle.
        poster={poster ?? undefined}
        className={cn('w-full h-full', objectFit === 'cover' ? 'object-cover object-center' : 'object-contain')}
        loop={loop || playOnFocus}
        muted={isMuted}
        playsInline
        // 'metadata' only grabs duration/dimensions/first-frame, not the
        // whole file — full resolution/quality on play is unaffected.
        preload={isInView ? 'metadata' : 'none'}
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      {!isInView && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          {poster && (
            <img
              src={poster}
              alt=""
              aria-hidden="true"
              className={cn(
                'absolute inset-0 h-full w-full',
                objectFit === 'cover' ? 'object-cover object-center' : 'object-contain',
              )}
            />
          )}
          <div className="relative w-16 h-16 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Play className="h-8 w-8 text-white/60 ml-1" />
          </div>
        </div>
      )}

      {/* Video Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300",
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlay}
            className="text-white hover:bg-white/20"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-white hover:bg-white/20"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/20"
            >
              <Maximize className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Play button overlay when paused */}
      {!isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
        </div>
      )}
    </div>
  );
};