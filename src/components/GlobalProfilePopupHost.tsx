import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MiniProfilePopup } from './MiniProfilePopup';

/**
 * Breadcrumb-friendly overlay host.
 *
 * When any navigation carries `location.state.overlayProfileId`, this host
 * re-opens the MiniProfilePopup for that user. Combined with the browser's
 * back-stack, this lets: Feed (popup open) → Profile → Messages → back → back
 * return the user to Feed with the same popup still open.
 */
export const GlobalProfilePopupHost = () => {
  const location = useLocation();
  const overlayId: string | undefined = (location.state as any)?.overlayProfileId;
  const [openId, setOpenId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setOpenId(overlayId);
  }, [overlayId, location.key]);

  if (!openId) return null;

  return (
    <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(undefined)}>
      <DialogContent
        className="p-0 border-none bg-transparent shadow-none max-w-fit w-auto flex items-center justify-center pointer-events-none"
        hideCloseButton
        onInteractOutside={() => setOpenId(undefined)}
      >
        <div className="pointer-events-auto">
          <MiniProfilePopup userId={openId} onClose={() => setOpenId(undefined)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};