import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface Follower {
  id: string;
  follower_id: string;
  following_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  follower?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    is_verified: boolean;
    verification_type?: string | null;
    verified_at?: string | null;
  };
  following?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    is_verified: boolean;
    verification_type?: string | null;
    verified_at?: string | null;
  };
}

export const useFollowers = (userId?: string) => {
  const { user } = useAuth();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [following, setFollowing] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchFollowers();

      // Set up real-time subscription for followers
      // Subscribe to changes where user is the follower OR following
      const channel = supabase
        .channel('followers-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'followers',
            filter: `follower_id=eq.${targetUserId}`
          },
          () => {
            fetchFollowers();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'followers',
            filter: `following_id=eq.${targetUserId}`
          },
          () => {
            fetchFollowers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [targetUserId]);

  const fetchFollowers = async () => {
    try {
      setLoading(true);

      // Fetch followers
      const { data: followersData, error: followersError } = await supabase
        .from('followers')
        .select(`
          *,
          follower:profiles!followers_follower_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            is_verified,
            verification_type,
            verified_at
          )
        `)
        .eq('following_id', targetUserId)
        .eq('status', 'accepted');

      if (followersError) throw followersError;

      // Fetch following
      const { data: followingData, error: followingError } = await supabase
        .from('followers')
        .select(`
          *,
          following:profiles!followers_following_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            is_verified,
            verification_type,
            verified_at
          )
        `)
        .eq('follower_id', targetUserId)
        .eq('status', 'accepted');

      if (followingError) throw followingError;

      setFollowers((followersData as any) || []);
      setFollowing((followingData as any) || []);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to load followers',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const followUser = async (followingId: string, isPrivate: boolean = false) => {
    if (!user || followingId === user.id) return;

    const tempId = `temp-${followingId}`;
    const optimisticRow: Follower = {
      id: tempId,
      follower_id: user.id,
      following_id: followingId,
      status: (isPrivate ? 'pending' : 'accepted') as Follower['status'],
      created_at: new Date().toISOString(),
    };

    // Optimistic UI flip — instant.
    setFollowing((prev) =>
      prev.some((f) => f.following_id === followingId) ? prev : [...prev, optimisticRow]
    );

    try {
      const { error } = await supabase
        .from('followers')
        .upsert(
          {
            follower_id: user.id,
            following_id: followingId,
            status: isPrivate ? 'pending' : 'accepted',
          },
          { onConflict: 'follower_id,following_id', ignoreDuplicates: true }
        );

      // Treat duplicate as success (already following) — never throw.
      if (error && error.code !== '23505') {
        // Revert optimistic row, keep app alive.
        setFollowing((prev) => prev.filter((f) => f.id !== tempId));
        toast({
          description: error.message?.toLowerCase().includes('network')
            ? 'Network error — try again'
            : 'Failed to follow',
          variant: 'destructive',
        });
        return;
      }

      // Quiet success — realtime subscription will reconcile the row.
      toast({ description: isPrivate ? 'Follow request sent' : 'Following' });
    } catch (err) {
      // Any unexpected throw — revert + soft toast, do NOT propagate.
      console.error('[follow] unexpected error', err);
      setFollowing((prev) => prev.filter((f) => f.id !== tempId));
      toast({ description: 'Failed to follow', variant: 'destructive' });
    }
  };

  const unfollowUser = async (followingId: string) => {
    if (!user) return;

    const snapshot = following;
    // Optimistic UI flip — instant.
    setFollowing((prev) => prev.filter((f) => f.following_id !== followingId));

    try {
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', followingId);

      if (error) {
        // Revert quietly.
        setFollowing(snapshot);
        toast({ description: 'Failed to unfollow', variant: 'destructive' });
        return;
      }

      toast({ description: 'Unfollowed' });
    } catch (err) {
      console.error('[unfollow] unexpected error', err);
      setFollowing(snapshot);
      toast({ description: 'Failed to unfollow', variant: 'destructive' });
    }
  };

  const acceptFollowRequest = async (followerId: string) => {
    try {
      const { error } = await supabase
        .from('followers')
        .update({ status: 'accepted' })
        .eq('follower_id', followerId)
        .eq('following_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Follow request accepted'
      });

      fetchFollowers();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const rejectFollowRequest = async (followerId: string) => {
    try {
      const { error } = await supabase
        .from('followers')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Follow request rejected'
      });

      fetchFollowers();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  // Check if current user and target user mutually follow each other
  const areMutualFollowers = (targetUserId: string): boolean => {
    if (!user) return false;
    
    // Check if current user follows target
    const currentUserFollowsTarget = following.some(f => f.following_id === targetUserId);
    // Check if target follows current user
    const targetFollowsCurrentUser = followers.some(f => f.follower_id === targetUserId);
    
    return currentUserFollowsTarget && targetFollowsCurrentUser;
  };

  // Get list of mutual followers (people who follow each other)
  const getMutualFollowers = (): string[] => {
    if (!user) return [];
    
    const followerIds = followers.map(f => f.follower_id);
    const followingIds = following.map(f => f.following_id);
    
    return followingIds.filter(id => followerIds.includes(id));
  };

  return {
    followers,
    following,
    loading,
    followUser,
    unfollowUser,
    acceptFollowRequest,
    rejectFollowRequest,
    areMutualFollowers,
    getMutualFollowers,
    refetch: fetchFollowers
  };
};
