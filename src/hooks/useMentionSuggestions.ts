import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MentionSuggestion {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  /** lower = closer to the user */
  rank: number;
}

interface Proximity {
  following: Set<string>;
  followers: Set<string>;
  recentChats: string[];
}

const emptyProximity: Proximity = {
  following: new Set(),
  followers: new Set(),
  recentChats: [],
};

/**
 * Ranks @-mention candidates by social proximity instead of alphabetically:
 * 1. mutual follows (close friends)
 * 2. people from recent chats
 * 3. people you follow / who follow you
 * 4. everyone else matching the query
 */
export const useMentionSuggestions = (query: string | null) => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const proximityRef = useRef<Proximity>(emptyProximity);
  const proximityLoaded = useRef(false);

  const loadProximity = useCallback(async () => {
    if (proximityLoaded.current || !user) return;
    proximityLoaded.current = true;
    try {
      const [followingRes, followersRes, chatRes] = await Promise.all([
        supabase.from('followers').select('following_id').eq('follower_id', user.id),
        supabase.from('followers').select('follower_id').eq('following_id', user.id),
        supabase
          .from('chat_participants')
          .select('chat_id')
          .eq('user_id', user.id)
          .limit(30),
      ]);

      const following = new Set<string>((followingRes.data || []).map((r: any) => r.following_id));
      const followers = new Set<string>((followersRes.data || []).map((r: any) => r.follower_id));

      let recentChats: string[] = [];
      const chatIds = (chatRes.data || []).map((r: any) => r.chat_id);
      if (chatIds.length > 0) {
        const { data: others } = await supabase
          .from('chat_participants')
          .select('user_id')
          .in('chat_id', chatIds)
          .neq('user_id', user.id)
          .limit(100);
        recentChats = Array.from(new Set((others || []).map((r: any) => r.user_id)));
      }

      proximityRef.current = { following, followers, recentChats };
    } catch {
      proximityRef.current = emptyProximity;
    }
  }, [user]);

  useEffect(() => {
    if (query === null) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      await loadProximity();
      try {
        const term = query.trim();
        let request = supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .limit(30);
        if (term) {
          request = request.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
        }
        const { data, error } = await request;
        if (error) throw error;
        if (cancelled) return;

        const { following, followers, recentChats } = proximityRef.current;
        const recent = new Set(recentChats);

        const ranked: MentionSuggestion[] = (data || [])
          .filter((p: any) => p.id !== user?.id && p.username)
          .map((p: any) => {
            const mutual = following.has(p.id) && followers.has(p.id);
            let rank = 4;
            if (mutual) rank = 0;
            else if (recent.has(p.id)) rank = 1;
            else if (following.has(p.id) || followers.has(p.id)) rank = 2;
            return { ...p, rank } as MentionSuggestion;
          })
          .sort((a, b) => a.rank - b.rank || a.username.localeCompare(b.username))
          .slice(0, 8);

        setSuggestions(ranked);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const t = setTimeout(run, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, loadProximity, user?.id]);

  return { suggestions, loading };
};
