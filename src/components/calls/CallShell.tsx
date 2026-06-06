import { ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface CallShellProps {
  kind: 'voice' | 'video';
  participantName: string;
  participantAvatar?: string;
  statusText: string;
  minimized: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  onEnd: () => void;
  /** Hidden remote audio/video sinks rendered always so the call stays live. */
  hiddenStreamMount?: ReactNode;
  /** Remote video node (video calls only). */
  remoteVideo?: ReactNode;
  /** Local PiP node (video calls only). */
  localPip?: ReactNode;
  /** Bottom control bar (mute / speaker / end / etc.). */
  controls: ReactNode;
  /** When true on video calls, auto-hide chrome after 3s of idle. */
  autoHideControls?: boolean;
}

export const CallShell = ({
  kind,
  participantName,
  participantAvatar,
  statusText,
  minimized,
  onMinimize,
  onRestore,
  onEnd,
  hiddenStreamMount,
  remoteVideo,
  localPip,
  controls,
  autoHideControls = false,
}: CallShellProps) => {
  const [chromeVisible, setChromeVisible] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoHideControls || minimized) {
      setChromeVisible(true);
      return;
    }
    const reset = () => {
      setChromeVisible(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setChromeVisible(false), 3000);
    };
    reset();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [autoHideControls, minimized]);

  return (
    <>
      {/* Hidden mount keeps Stream call alive while minimized */}
      <div className="sr-only" aria-hidden>
        {hiddenStreamMount}
      </div>

      {minimized ? (
        <button
          type="button"
          onClick={onRestore}
          className="fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-3 py-2 touch-manipulation animate-in fade-in slide-in-from-top-2"
          aria-label="Return to call"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={participantAvatar} />
            <AvatarFallback className="text-xs">
              {participantName[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium max-w-[8rem] truncate">{statusText}</span>
          <Button
            size="icon"
            variant="destructive"
            className="h-7 w-7 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onEnd();
            }}
            aria-label="End call"
          >
            <ChevronDown className="h-4 w-4 rotate-180" />
          </Button>
        </button>
      ) : (
        <div
          className={cn(
            'fixed inset-0 z-[90] h-[100dvh] w-screen text-foreground',
            kind === 'video'
              ? 'bg-black text-white'
              : 'bg-gradient-to-b from-primary/15 via-background to-background',
          )}
          onClick={() => autoHideControls && setChromeVisible((v) => !v)}
        >
          {kind === 'video' && remoteVideo && (
            <div className="absolute inset-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full">
              {remoteVideo}
            </div>
          )}

          {/* Top bar */}
          <div
            className={cn(
              'absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3 transition-opacity duration-300',
              kind === 'video' && 'bg-gradient-to-b from-black/60 to-transparent',
              chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={onMinimize}
              className={cn(
                'h-10 w-10 rounded-full touch-manipulation',
                kind === 'video' && 'text-white hover:bg-white/10',
              )}
              aria-label="Minimize call"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <div className="text-sm font-semibold leading-tight truncate max-w-[60vw]">
                {participantName}
              </div>
              <div
                className={cn(
                  'text-xs leading-tight',
                  kind === 'video' ? 'text-white/80' : 'text-muted-foreground',
                )}
              >
                {statusText}
              </div>
            </div>
            <div className="w-10" />
          </div>

          {/* Voice-call hero (avatar + name) */}
          {kind === 'voice' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <Avatar className="h-36 w-36 ring-4 ring-primary/20 shadow-2xl">
                <AvatarImage src={participantAvatar} />
                <AvatarFallback className="text-5xl bg-primary/10">
                  {participantName[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-8 text-3xl font-semibold tracking-tight">{participantName}</h2>
              <p className="mt-2 text-base text-muted-foreground">{statusText}</p>
            </div>
          )}

          {/* Video PiP */}
          {kind === 'video' && localPip && (
            <div
              className={cn(
                'absolute top-20 right-4 z-10 transition-opacity duration-300',
                chromeVisible ? 'opacity-100' : 'opacity-70',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {localPip}
            </div>
          )}

          {/* Bottom controls */}
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 z-10 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6 transition-all duration-300',
              kind === 'video' && 'bg-gradient-to-t from-black/70 via-black/40 to-transparent',
              chromeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {controls}
          </div>
        </div>
      )}
    </>
  );
};

export default CallShell;