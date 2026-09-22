import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MiniProfilePopup } from "./MiniProfilePopup";
import { useState, useCallback, useRef } from "react";

interface ProfileHoverCardProps {
  userId: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const ProfileHoverCard = ({ userId, children, disabled }: ProfileHoverCardProps) => {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const didLongPressOpen = useRef(false);

  const clearTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Only handle left mouse button for mouse events
    if ('button' in e && e.button !== 0) return;

    const point = 'touches' in e ? e.touches[0] : e;
    const pressX = point.clientX;
    const pressY = point.clientY;

    didLongPressOpen.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPressOpen.current = true;
      // Subtle haptic tick so the peek feels native on mobile.
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(12);
      setOrigin({ x: pressX, y: pressY });
      setOpen(true);
    }, 500);
  }, []);

  const handleEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    clearTimer();
    // If we opened via long press, prevent the click from navigating
    if (didLongPressOpen.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [clearTimer]);

  const handleMove = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // If we just opened via long press, prevent click
    if (didLongPressOpen.current) {
      e.preventDefault();
      e.stopPropagation();
      didLongPressOpen.current = false;
    }
  }, []);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onTouchMove={handleMove}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleMove}
        onClick={handleClick}
        className="touch-manipulation select-none"
      >
        {children}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 border-none bg-transparent shadow-none max-w-fit w-auto flex items-center justify-center pointer-events-none duration-200 data-[state=open]:zoom-in-50 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 !left-[var(--popup-x)] !top-[var(--popup-y)] !translate-x-0 !translate-y-0"
          overlayClassName="bg-background/40 backdrop-blur-md"
          hideCloseButton
          onInteractOutside={() => setOpen(false)}
          style={origin ? ({
            // Anchors the popup near the actual press point and sets the
            // animation's transform-origin there too, so it visibly grows
            // out from where the name was held instead of just fading in
            // dead-center on screen.
            '--popup-x': `${Math.min(Math.max(160, origin.x), (typeof window !== 'undefined' ? window.innerWidth : 360) - 160)}px`,
            '--popup-y': `${Math.min(Math.max(140, origin.y + 24), (typeof window !== 'undefined' ? window.innerHeight : 640) - 140)}px`,
            transformOrigin: `${origin.x}px ${origin.y}px`,
          } as React.CSSProperties) : undefined}
        >
          <div className="pointer-events-auto drop-shadow-2xl">
            <MiniProfilePopup userId={userId} onClose={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};