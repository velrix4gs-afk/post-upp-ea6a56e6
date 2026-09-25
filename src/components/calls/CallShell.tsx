import { ReactNode, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

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
  setupError?: string;
  onRetry?: () => void;
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
  setupError,
  onRetry,
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

  return createPortal(
    <>
      {/* Hidden mount keeps Stream call alive while minimized */}
      <div className="sr-only" aria-hidden>
        {hiddenStreamMount}
      </div>

      {minimized ? (
        <div data-no-app-swipe className="fixed right-4 top-[max(env(safe-area-inset-top),1rem)] z-[200] flex items-center gap-2 rounded-full bg-primary px-2 py-1.5 text-primary-foreground shadow-lg touch-manipulation animate-in fade-in slide-in-from-top-2">
          <button
            type="button"
            onClick={onRestore}
            className="flex min-h-10 min-w-10 items-center gap-2 rounded-full text-left"
            aria-label="Return to call"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={participantAvatar} />
              <AvatarFallback className="text-xs">
                {participantName[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[8rem] truncate text-xs font-medium">{statusText}</span>
          </button>
          <Button
            size="icon"
            variant="destructive"
            className="h-9 w-9 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              onEnd();
            }}
            aria-label="End call"
          >
            <ChevronDown className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      ) : (
        <div
          data-no-app-swipe
          className={cn(
            'fixed inset-0 z-[200] h-[100dvh] w-screen text-foreground',
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

          {setupError && (
            <div
              role="alert"
              className="absolute inset-x-6 top-1/2 z-20 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-destructive/20 bg-background/95 p-5 text-center shadow-2xl backdrop-blur"
              onClick={(event) => event.stopPropagation()}
            >
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
              <p className="mt-3 text-sm font-medium">{setupError}</p>
              {onRetry && (
                <Button className="mt-4" onClick={onRetry}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try again
                </Button>
              )}
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
    </>,
    document.body,
  );
};

export default CallShell;