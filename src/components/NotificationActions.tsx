import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFriends } from '@/hooks/useFriends';
import { useFollowers } from '@/hooks/useFollowers';
import { Loader2 } from 'lucide-react';

interface NotificationActionsProps {
  notification: any;
  onDone?: () => void;
}

export const getActorId = (notification: any): string | undefined =>
  notification?.data?.actor_id ||
  notification?.data?.follower_id ||
  notification?.data?.requester_id ||
  notification?.data?.from_user_id ||
  notification?.data?.user_id;

/**
 * Inline, actionable controls on a notification — accept/decline a request or
 * follow back — so the user can respond without leaving the panel.
 */
export const NotificationActions = ({ notification, onDone }: NotificationActionsProps) => {
  const { acceptFriendRequest, declineFriendRequest } = useFriends();
  const { following, followUser, acceptFollowRequest, rejectFollowRequest } = useFollowers();
  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null);
  const [resolved, setResolved] = useState<string | null>(null);

  const actorId = getActorId(notification);
  const type = notification?.type;

  if (!actorId) return null;
  if (resolved) {
    return <p className="mt-2 text-xs text-muted-foreground">{resolved}</p>;
  }

  const run = async (which: 'accept' | 'decline', fn: () => Promise<any>, label: string) => {
    setBusy(which);
    try {
      await fn();
      setResolved(label);
      onDone?.();
    } finally {
      setBusy(null);
    }
  };

  if (type === 'friend_request') {
    return (
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          className="h-8 px-3 text-xs rounded-lg flex-1"
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation();
            run('accept', () => acceptFriendRequest(actorId), 'Request accepted');
          }}
        >
          {busy === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Accept'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs rounded-lg flex-1"
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation();
            run('decline', () => declineFriendRequest(actorId), 'Request declined');
          }}
        >
          {busy === 'decline' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Decline'}
        </Button>
      </div>
    );
  }

  if (type === 'follow_request') {
    return (
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          className="h-8 px-3 text-xs rounded-lg flex-1"
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation();
            run('accept', () => acceptFollowRequest(actorId), 'Follower accepted');
          }}
        >
          {busy === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs rounded-lg flex-1"
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation();
            run('decline', () => rejectFollowRequest(actorId), 'Request removed');
          }}
        >
          {busy === 'decline' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Delete'}
        </Button>
      </div>
    );
  }

  if (type === 'follow') {
    const alreadyFollowing = following.some((f) => f.following_id === actorId);
    if (alreadyFollowing) return null;
    return (
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          className="h-8 px-3 text-xs rounded-lg"
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation();
            run('accept', () => followUser(actorId), 'Following');
          }}
        >
          {busy === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Follow back'}
        </Button>
      </div>
    );
  }

  return null;
};