import { Toaster } from '@/components/ui/toaster';
import { ToasterMobile } from '@/components/ui/sonner-mobile';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Mounts exactly ONE toast surface.
 *
 * Both `Toaster` (desktop, bottom-center) and `ToasterMobile` (top-center,
 * short dismiss) wrap sonner. Sonner's event bus is module-global, so two
 * mounted instances both render every toast — the duplicate-notification bug.
 * Rendering only the matching one for the current viewport fixes it while
 * keeping both layouts.
 */
export const ToastHost = () => {
  const isMobile = useIsMobile();
  return isMobile ? <ToasterMobile /> : <Toaster />;
};
