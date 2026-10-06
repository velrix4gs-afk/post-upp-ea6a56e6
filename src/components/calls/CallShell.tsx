import { ReactNode, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, PhoneOff, RefreshCw } from 'lucide-react';
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
  const minimizeTouch = useRef<{ x: number; y: number } | null>(null);
  const restoreTouch = useRef<{ x: number; y: number } | null>(null);

  const onCallTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-call-gesture-ignore]')) {
      minimizeTouch.current = null;
      return;
    }
    const touch = event.touches[0];
    if (touch) minimizeTouch.current = { x: touch.clientX, y: touch.clientY };
  };

  const onCallTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = minimizeTouch.current;
    minimizeTouch.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dy > 88 && dy > Math.abs(dx) * 1.2) onMinimize();
  };

  const onCompactTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-call-gesture-ignore]')) {
      restoreTouch.current = null;
      return;
    }
    const touch = event.touches[0];
    if (touch) restoreTouch.current = { x: touch.clientX, y: touch.clientY };
  };

  const onCompactTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = restoreTouch.current;
    restoreTouch.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dy < -72 && Math.abs(dy) > Math.abs(dx) * 1.2) onRestore();
  };

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
        kind === 'video' ? (
          <div
            data-no-app-swipe
            onTouchStart={onCompactTouchStart}
            onTouchEnd={onCompactTouchEnd}
            onTouchCancel={() => { restoreTouch.current = null; }}
            className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] right-4 z-[200] h-44 w-64 overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/20 animate-in fade-in zoom-in-95"
          >
            <button type="button" onClick={onRestore} className="absolute inset-0 h-full w-full" aria-label="Return to video call">
              <span className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
                {remoteVideo}
              </span>
            </button>
            {localPip && (
              <div className="pointer-events-none absolute bottom-2 right-2 z-10 h-14 w-12 overflow-hidden rounded-lg border border-white/50 [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
                {localPip}
              </div>
            )}
            <div className="absolute left-2 right-2 top-2 z-20 flex items-center justify-between gap-2">
              <span className="max-w-40 truncate rounded-full bg-black/80 px-2.5 py-1 text-xs font-medium text-white">
                {participantName} · {statusText}
              </span>
              <Button
                size="icon"
                variant="destructive"
                className="h-9 w-9 shrink-0 rounded-full shadow-lg"
                onClick={onEnd}
                data-call-gesture-ignore
                aria-label="End call"
              >
                <PhoneOff className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div data-no-app-swipe onTouchStart={onCompactTouchStart} onTouchEnd={onCompactTouchEnd} onTouchCancel={() => { restoreTouch.current = null; }} className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] right-4 z-[200] flex items-center gap-2 rounded-full border border-border bg-background p-1.5 text-foreground shadow-2xl touch-manipulation animate-in fade-in slide-in-from-bottom-2">
            <button
              type="button"
              onClick={onRestore}
              className="flex min-h-11 min-w-11 items-center gap-2 rounded-full pl-1 text-left"
              aria-label="Return to voice call"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={participantAvatar} />
                <AvatarFallback className="text-xs">
                  {participantName[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-[9rem] truncate text-xs font-medium">{participantName} · {statusText}</span>
            </button>
            <Button
              size="icon"
              variant="destructive"
              className="h-10 w-10 rounded-full"
              onClick={onEnd}
              data-call-gesture-ignore
              aria-label="End call"
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>
        )
      ) : (
        <div
          data-no-app-swipe
          className={cn(
            'fixed inset-0 z-[200] h-[100dvh] w-screen text-foreground',
            kind === 'video'
              ? 'bg-black text-white'
              // Solid brand surface for audio calls. Previously a flat slate
              // (#101827) that read as murky grey; this uses the app's own
              // purple accent so a call looks like POST-UPP rather than a
              // generic overlay.
              : 'bg-[hsl(262_83%_28%)] text-white',
          )}
          onClick={() => autoHideControls && setChromeVisible((v) => !v)}
          onTouchStart={onCallTouchStart}
          onTouchEnd={onCallTouchEnd}
          onTouchCancel={() => { minimizeTouch.current = null; }}
          style={{ touchAction: 'none' }}
        >
          {kind === 'video' && remoteVideo && (
            <div className="absolute inset-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full">
              {remoteVideo}
            </div>
          )}

          {setupError && (
            <div
              role="alert"
              className="absolute inset-x-6 top-1/2 z-20 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-destructive/40 bg-[hsl(262_83%_20%)] p-5 text-center text-white shadow-2xl"
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
              kind === 'video' && 'bg-gradient-to-b from-black/70 to-transparent',
              chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
            onClick={(e) => e.stopPropagation()}
            data-call-gesture-ignore
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
                  'text-white/70',
                )}
              >
                {statusText}
              </div>
            </div>
            <div className="w-10" />
          </div>

          {/* Voice-call hero (avatar + name) */}
          {kind === 'voice' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-8 text-center">
              <div className="pointer-events-none absolute h-[30rem] w-[30rem] rounded-full bg-[hsl(262_83%_70%)]/20 blur-3xl" />
              <Avatar className="relative h-36 w-36 ring-4 ring-primary/50 shadow-[0_0_60px_rgba(59,130,246,0.2)]">
                <AvatarImage src={participantAvatar} />
                <AvatarFallback className="bg-slate-800 text-5xl text-white">
                  {participantName[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <h2 className="relative mt-8 text-3xl font-semibold tracking-tight">{participantName}</h2>
              <p className="relative mt-2 text-base text-white/70">{statusText}</p>
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
              data-call-gesture-ignore
            >
              {localPip}
            </div>
          )}

          {/* Bottom controls */}
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 z-10 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6 transition-all duration-300',
              'bg-gradient-to-t from-black/85 via-black/35 to-transparent',
              chromeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
            )}
            onClick={(e) => e.stopPropagation()}
            data-call-gesture-ignore
          >
            <div className="mx-auto w-fit max-w-full rounded-[2rem] border border-white/15 bg-black/35 p-2 shadow-2xl">
              {controls}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
};

export default CallShell;