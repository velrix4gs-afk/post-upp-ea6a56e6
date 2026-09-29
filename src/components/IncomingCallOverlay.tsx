import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useEffect } from 'react';
import { useCallNotifications } from '@/hooks/useCallNotifications';
import { useNavigate } from 'react-router-dom';
import { haptic } from '@/lib/haptics';

export const IncomingCallOverlay = () => {
  const { incomingCall, ringing, acceptCall, declineCall } = useCallNotifications();
  const navigate = useNavigate();

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
      navigate('/messages', {
        state: { openChatId: call.call_id, callType: call.call_type, autoJoin: true },
      });
    }
  };

  const handleDecline = () => {
    haptic('error');
    void declineCall();
  };

  const isVideo = incomingCall.call_type === 'video';

  return (
    <section
      className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-[9999] mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[22rem]"
      role="status"
      aria-label={`Incoming ${isVideo ? 'video' : 'voice'} call`}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 shrink-0 ring-2 ring-primary/20">
          <AvatarImage src={incomingCall.caller_avatar} />
          <AvatarFallback>{incomingCall.caller_name[0]?.toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{incomingCall.caller_name}</p>
          <p className="text-sm text-muted-foreground">Incoming {isVideo ? 'video' : 'voice'} call</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="icon"
            variant="destructive"
            className="h-11 w-11 rounded-full"
            onClick={handleDecline}
            aria-label="Decline call"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            className="h-11 w-11 rounded-full bg-green-600 text-white hover:bg-green-700"
            onClick={handleAccept}
            aria-label="Accept call"
          >
            {isVideo ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default IncomingCallOverlay;
