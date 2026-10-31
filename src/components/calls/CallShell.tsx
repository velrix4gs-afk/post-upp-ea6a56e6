import { ReactNode, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, PhoneOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { CallAudioOrb } from '@/components/visualizers/CallAudioOrb';

interface CallShellProps {
  kind: 'voice' | 'video';
  participantName: string;
  participantAvatar?: string;
  statusText: string;
  minimized: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  onEnd: () => void;
  hiddenStreamMount?: ReactNode;
  remoteVideo?: ReactNode;
  localPip?: ReactNode;
  controls: ReactNode;
  setupError?: string;
  onRetry?: () => void;
  autoHideControls?: boolean;
  voiceLevel?: number;
}

export const CallShell = ({ kind, participantName, participantAvatar, statusText, minimized, onMinimize, onRestore, onEnd, hiddenStreamMount, remoteVideo, localPip, controls, setupError, onRetry, autoHideControls = false, voiceLevel }: CallShellProps) => {
  const [chromeVisible, setChromeVisible] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minimizeTouch = useRef<{ x: number; y: number } | null>(null);
  const restoreTouch = useRef<{ x: number; y: number } | null>(null);

  const onCallTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-call-gesture-ignore]')) { minimizeTouch.current = null; return; }
    const touch = event.touches[0];
    if (touch) minimizeTouch.current = { x: touch.clientX, y: touch.clientY };
  };
  const onCallTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = minimizeTouch.current; minimizeTouch.current = null;
    const touch = event.changedTouches[0]; if (!start || !touch) return;
    const dx = touch.clientX - start.x; const dy = touch.clientY - start.y;
    if (dy > 88 && dy > Math.abs(dx) * 1.2) onMinimize();
  };
  const onCompactTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-call-gesture-ignore]')) { restoreTouch.current = null; return; }
    const touch = event.touches[0];
    if (touch) restoreTouch.current = { x: touch.clientX, y: touch.clientY };
  };
  const onCompactTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = restoreTouch.current; restoreTouch.current = null;
    const touch = event.changedTouches[0]; if (!start || !touch) return;
    const dx = touch.clientX - start.x; const dy = touch.clientY - start.y;
    if (dy < -72 && Math.abs(dy) > Math.abs(dx) * 1.2) onRestore();
  };

  useEffect(() => {
    if (!autoHideControls || minimized) { setChromeVisible(true); return; }
    const reset = () => { setChromeVisible(true); if (idleTimer.current) clearTimeout(idleTimer.current); idleTimer.current = setTimeout(() => setChromeVisible(false), 3000); };
    reset();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [autoHideControls, minimized]);

  return createPortal(
    <>
      <div className="sr-only" aria-hidden>{hiddenStreamMount}</div>
      {minimized ? (
        kind === 'video' ? (
          <div data-no-app-swipe onTouchStart={onCompactTouchStart} onTouchEnd={onCompactTouchEnd} className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] right-4 z-[200] h-44 w-64 overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/20 animate-in fade-in zoom-in-95">
            <button type="button" onClick={onRestore} className="absolute inset-0 h-full w-full"><span className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover">{remoteVideo}</span></button>
            <div className="absolute left-2 right-2 top-2 z-20 flex items-center justify-between gap-2">
              <span className="max-w-40 truncate rounded-full bg-black/80 px-2.5 py-1 text-xs font-medium text-white">{participantName} · {statusText}</span>
              <Button size="icon" variant="destructive" className="h-9 w-9 shrink-0 rounded-full shadow-lg" onClick={onEnd}><PhoneOff className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : (
          <div data-no-app-swipe onTouchStart={onCompactTouchStart} onTouchEnd={onCompactTouchEnd} className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] right-4 z-[200] flex items-center gap-2 rounded-full border border-border bg-background p-1.5 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
            <button type="button" onClick={onRestore} className="flex min-h-11 min-w-11 items-center gap-2 rounded-full pl-1 text-left">
              <Avatar className="h-9 w-9"><AvatarImage src={participantAvatar} /><AvatarFallback className="text-xs">{participantName[0]?.toUpperCase() || 'U'}</AvatarFallback></Avatar>
              <span className="max-w-[9rem] truncate text-xs font-medium">{participantName} · {statusText}</span>
            </button>
            <Button size="icon" variant="destructive" className="h-10 w-10 rounded-full" onClick={onEnd}><PhoneOff className="h-4 w-4" /></Button>
          </div>
        )
      ) : (
        <div data-no-app-swipe className={cn('fixed inset-0 z-[200] h-[100dvh] w-screen text-foreground', kind === 'video' ? 'bg-black text-white' : 'bg-gradient-to-br from-[#1a0b2e] via-[#2d1554] to-[#0d0518] text-white')} onClick={() => autoHideControls && setChromeVisible(v => !v)} onTouchStart={onCallTouchStart} onTouchEnd={onCallTouchEnd} style={{ touchAction: 'none' }}>
          {kind === 'video' && remoteVideo && <div className="absolute inset-0 [&_video]:object-cover [&_video]:w-full [&_video]:h-full">{remoteVideo}</div>}

          {setupError && (
            <div role="alert" className="absolute inset-x-6 top-1/2 z-20 mx-auto max-w-sm -translate-y-1/2 rounded-2xl border border-destructive/40 bg-black/80 backdrop-blur-xl p-5 text-center text-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" /><p className="mt-3 text-sm font-medium">{setupError}</p>
              {onRetry && <Button className="mt-4" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>}
            </div>
          )}

          <div className={cn('absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3 transition-opacity duration-300', kind === 'video' && 'bg-gradient-to-b from-black/70 to-transparent', chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none')} onClick={e => e.stopPropagation()} data-call-gesture-ignore>
            <Button variant="ghost" size="icon" onClick={onMinimize} className="h-10 w-10 rounded-full text-white hover:bg-white/10"><ChevronDown className="h-5 w-5" /></Button>
            <div className="text-center"><div className="text-sm font-semibold truncate max-w-[60vw] text-white">{participantName}</div><div className="text-xs text-white/60">{statusText}</div></div>
            <div className="w-10" />
          </div>

          {kind === 'voice' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-8 text-center">
              {voiceLevel === undefined ? <div className="pointer-events-none absolute h-[24rem] w-[24rem] rounded-full bg-primary/20 blur-[100px]" /> : <div className="pointer-events-none absolute h-[26rem] w-[26rem]"><CallAudioOrb level={voiceLevel} color="#c13aed" preset="abyss" /></div>}
              <Avatar className="relative h-32 w-32 ring-4 ring-white/10 shadow-2xl"><AvatarImage src={participantAvatar} className="object-cover" /><AvatarFallback className="bg-white/10 text-4xl text-white backdrop-blur-md">{participantName[0]?.toUpperCase() || 'U'}</AvatarFallback></Avatar>
              <h2 className="relative mt-8 text-3xl font-bold tracking-tight text-white">{participantName}</h2>
              <p className="relative mt-2 text-sm font-medium text-white/60">{statusText}</p>
            </div>
          )}

          {kind === 'video' && localPip && <div className={cn('absolute top-20 right-4 z-10 transition-opacity duration-300', chromeVisible ? 'opacity-100' : 'opacity-70')} onClick={e => e.stopPropagation()} data-call-gesture-ignore>{localPip}</div>}

          <div className={cn('absolute bottom-0 left-0 right-0 z-10 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4 transition-all duration-300', 'bg-gradient-to-t from-black/80 via-black/40 to-transparent', chromeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4')} onClick={e => e.stopPropagation()} data-call-gesture-ignore>
            <div className="flex items-center justify-center gap-3 sm:gap-4 overflow-x-auto px-2">{controls}</div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};
export default CallShell;