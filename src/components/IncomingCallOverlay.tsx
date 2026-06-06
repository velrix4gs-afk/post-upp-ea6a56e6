import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useEffect } from 'react';
import { useCallNotifications } from '@/hooks/useCallNotifications';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export const IncomingCallOverlay = () => {
  const { incomingCall, ringing, acceptCall, declineCall } = useCallNotifications();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Vibrate on ring (mobile only)
  useEffect(() => {
    if (!ringing) return;
    haptic('warning');
    const id = setInterval(() => haptic('warning'), 1800);
    return () => clearInterval(id);
  }, [ringing]);

  if (!ringing || !incomingCall) return null;

  const handleAccept = () => {
    haptic('success');
    const call = acceptCall();
    if (call) {
      navigate(`/messages/${call.call_id}`, {
        state: { callType: call.call_type, autoJoin: true },
      });
    }
  };

  const handleDecline = () => {
    haptic('error');
    declineCall();
  };

  const isVideo = incomingCall.call_type === 'video';

  // Mobile: full-screen WhatsApp-style incoming screen
  if (isMobile) {
    return (
      <div
        className={cn(
          'fixed inset-0 z-[9999] h-[100dvh] w-screen flex flex-col items-center justify-between py-[max(env(safe-area-inset-top),3rem)] pb-[max(env(safe-area-inset-bottom),3rem)] touch-manipulation',
          'bg-gradient-to-b from-primary/20 via-background to-background',
        )}
        role="alertdialog"
        aria-label={`Incoming ${isVideo ? 'video' : 'voice'} call`}
      >
        <div className="flex flex-col items-center text-center px-8">
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-3">
            Incoming {isVideo ? 'video' : 'voice'} call
          </p>
          <Avatar className="h-32 w-32 ring-4 ring-primary/30 shadow-2xl animate-pulse">
            <AvatarImage src={incomingCall.caller_avatar} />
            <AvatarFallback className="text-4xl">
              {incomingCall.caller_name[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <h3 className="mt-6 text-3xl font-semibold tracking-tight">
            {incomingCall.caller_name}
          </h3>
        </div>

        <div className="w-full px-12 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDecline}
            className="flex flex-col items-center gap-2 touch-manipulation"
            aria-label="Decline"
          >
            <span className="h-16 w-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg">
              <PhoneOff className="h-7 w-7" />
            </span>
            <span className="text-xs text-muted-foreground">Decline</span>
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex flex-col items-center gap-2 touch-manipulation"
            aria-label="Accept"
          >
            <span className="h-16 w-16 rounded-full bg-green-600 text-white flex items-center justify-center shadow-lg animate-pulse">
              {isVideo ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
            </span>
            <span className="text-xs text-muted-foreground">Accept</span>
          </button>
        </div>
        <audio src="/ringtone.mp3" loop />
      </div>
    );
  }

  // Desktop: compact card
  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in touch-manipulation">
      <div className="bg-background rounded-2xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl">
        <div className="space-y-4">
          <Avatar className="h-24 w-24 mx-auto ring-4 ring-primary">
            <AvatarImage src={incomingCall.caller_avatar} />
            <AvatarFallback>{incomingCall.caller_name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-2xl font-bold">{incomingCall.caller_name}</h3>
            <p className="text-muted-foreground">
              Incoming {incomingCall.call_type} call…
            </p>
          </div>
        </div>
        <div className="flex gap-4 justify-center">
          <Button
            size="icon"
            variant="destructive"
            className="rounded-full h-16 w-16"
            onClick={handleDecline}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            className="rounded-full h-16 w-16 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleAccept}
          >
            {isVideo ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
          </Button>
        </div>
        <audio src="/ringtone.mp3" loop />
      </div>
    </div>
  );
};

export default IncomingCallOverlay;