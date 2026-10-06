import { Toaster as Sonner } from 'sonner';

// Auto-dismiss duration in milliseconds
const AUTO_DISMISS_DURATION = 2000;

/**
 * Mobile toast surface: same sonner queue as the desktop `Toaster`, but
 * anchored top-center with a shorter dismiss time and swipe-to-dismiss.
 *
 * It must never be mounted at the same time as the desktop `Toaster` — two
 * live <Sonner> instances both subscribe to the same event bus and render
 * every toast, which is what made notifications appear twice. Mount exactly
 * one, chosen by viewport. See `ToastHost`.
 */
export function ToasterMobile() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        duration: AUTO_DISMISS_DURATION,
        classNames: {
          toast: 'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:cursor-grab active:group-[.toaster]:cursor-grabbing',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:hover:bg-muted/80',
        },
      }}
      closeButton
      richColors
      expand
    />
  );
}
