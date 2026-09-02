import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from './use-toast';

export interface SearchResult {
  type: 'user' | 'post' | 'group';
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  verified?: boolean;
  data: any;
}

export const useSearch = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const searchTerm = `%${query}%`;

      // Search users - only show discoverable profiles
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url, cover_url, is_verified, verification_type, is_private, is_profile_complete, created_at')
        .or(`display_name.ilike.${searchTerm},username.ilike.${searchTerm},bio.ilike.${searchTerm}`)
        .eq('is_profile_complete', true)
        .limit(10);

      if (usersError) throw usersError;

      // Search posts by content or hashtags
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .ilike('content', searchTerm)
        .eq('privacy', 'public')
        .limit(10);

      if (postsError) throw postsError;

      const searchResults: SearchResult[] = [
        ...(users || []).map(user => ({
          type: 'user' as const,
          id: user.id,
          title: user.display_name,
          subtitle: `@${user.username}`,
          avatar: user.avatar_url,
          verified: user.is_verified,
          data: user
        })),
        ...(posts || []).map(post => ({
          type: 'post' as const,
          id: post.id,
          title: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
          subtitle: `by ${post.profiles.display_name}`,
          avatar: post.profiles.avatar_url,
          verified: post.profiles.is_verified,
          data: post
        }))
      ];

      setResults(searchResults);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Search failed',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getSuggestions = async () => {
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_verified')
        .eq('is_private', false)
        .eq('is_profile_complete', true)
        .limit(5);

      if (error) throw error;

      return (users || []).map(user => ({
        type: 'user' as const,
        id: user.id,
        title: user.display_name,
        subtitle: `@${user.username}`,
        avatar: user.avatar_url,
        verified: user.is_verified,
        data: user
      }));
    } catch (err: any) {
      return [];
    }
  };

  return {
    results,
    loading,
    search,
    getSuggestions
  };
};