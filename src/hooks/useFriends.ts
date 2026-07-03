import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { shouldShowErrorToast } from '@/lib/errorSuppression';

// Module-level dedupe: swallow the same error toast if fired within 10s.
const _lastToastAt: Record<string, number> = {};
const toastOnce = (key: string, opts: Parameters<typeof toast>[0]) => {
  const now = Date.now();
  if (_lastToastAt[key] && now - _lastToastAt[key] < 10_000) return;
  _lastToastAt[key] = now;
  toast(opts);
};
const errorToast = (key: string, err: unknown, description: string) => {
  if (!shouldShowErrorToast(err)) return;
  toastOnce(`err:${key}`, { title: 'Error', description, variant: 'destructive' });
};

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  requester: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    is_verified: boolean;
  };
  addressee: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    is_verified: boolean;
  };
}

export const useFriends = () => {
  const { user } = useAuth();
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFriendships();

      // Set up real-time subscription for friendships
      // Subscribe to changes where user is requester OR addressee
      const channel = supabase
        .channel('friendships-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friendships',
            filter: `requester_id=eq.${user.id}`
          },
          () => {
            fetchFriendships();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'friendships',
            filter: `addressee_id=eq.${user.id}`
          },
          () => {
            fetchFriendships();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchFriendships = async () => {
    try {
      if (!user) { setFriendships([]); return; }
      // Query the friendships table directly under RLS to avoid the
      // flaky edge function that spams "Failed to fetch" while offline.
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id, requester_id, addressee_id, status, created_at, updated_at,
          requester:profiles!friendships_requester_id_fkey (
            id, username, display_name, avatar_url, is_verified
          ),
          addressee:profiles!friendships_addressee_id_fkey (
            id, username, display_name, avatar_url, is_verified
          )
        `)
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (error) throw error;
      setFriendships((data as any) || []);
    } catch (err: any) {
      // Silent — do not spam console/toast during offline retries.
      // Keep whatever we already had cached in state.
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (addresseeId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('friendships', {
        method: 'POST',
        body: { addressee_id: addresseeId, action: 'request' }
      });

      if (error) throw error;
      await fetchFriendships();
      toast({
        title: 'Success',
        description: 'Friend request sent'
      });
    } catch (err: any) {
      errorToast('sendFriendRequest', err, err?.message || 'Could not send friend request');
    }
  };

  const acceptFriendRequest = async (requesterId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('friendships', {
        method: 'POST',
        body: { addressee_id: requesterId, action: 'accept' }
      });

      if (error) throw error;
      await fetchFriendships();
      toast({
        title: 'Success',
        description: 'Friend request accepted'
      });
    } catch (err: any) {
      errorToast('acceptFriendRequest', err, err?.message || 'Could not accept friend request');
    }
  };

  const declineFriendRequest = async (requesterId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('friendships', {
        method: 'POST',
        body: { addressee_id: requesterId, action: 'decline' }
      });

      if (error) throw error;
      await fetchFriendships();
      toast({
        title: 'Success',
        description: 'Friend request declined'
      });
    } catch (err: any) {
      errorToast('declineFriendRequest', err, err?.message || 'Could not decline friend request');
    }
  };

  const removeFriend = async (friendId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('friendships', {
        method: 'DELETE',
        body: { friend_id: friendId }
      });

      if (error) throw error;
      await fetchFriendships();
      toast({
        title: 'Success',
        description: 'Friend removed'
      });
    } catch (err: any) {
      errorToast('removeFriend', err, err?.message || 'Could not remove friend');
    }
  };

  const getFriends = () => {
    return friendships.filter(f => f.status === 'accepted').map(f => {
      const friend = f.requester_id === user?.id ? f.addressee : f.requester;
      return { ...friend, friendship_id: f.id };
    });
  };

  const getPendingRequests = () => {
    return friendships.filter(f => 
      f.status === 'pending' && f.addressee_id === user?.id
    );
  };

  const getSentRequests = () => {
    return friendships.filter(f => 
      f.status === 'pending' && f.requester_id === user?.id
    );
  };

  const getMutualFriends = (targetUserId: string) => {
    if (!user) return [];
    
    const myFriends = getFriends().map(f => f.id);
    const targetFriendships = friendships.filter(f => 
      f.status === 'accepted' && 
      (f.requester_id === targetUserId || f.addressee_id === targetUserId)
    );
    
    const targetFriends = targetFriendships.map(f => 
      f.requester_id === targetUserId ? f.addressee_id : f.requester_id
    );
    
    return myFriends.filter(id => targetFriends.includes(id));
  };

  return {
    friendships,
    friends: getFriends(),
    pendingRequests: getPendingRequests(),
    sentRequests: getSentRequests(),
    getMutualFriends,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    refetch: fetchFriendships
  };
};