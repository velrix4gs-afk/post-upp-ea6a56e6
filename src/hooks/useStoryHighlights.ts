import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { resolveStoryMediaUrl, storyObjectPath, type Story } from './useStories';

const errorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'Please try again.'
);

export interface StoryHighlight {
  id: string;
  user_id: string;
  title: string;
  cover_image?: string;
  created_at: string;
  story_count?: number;
}

export const useStoryHighlights = (userId?: string) => {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<StoryHighlight[]>([]);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || user?.id;

  const fetchHighlights = useCallback(async () => {
    if (!targetUserId) {
      setHighlights([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('story_highlights')
        .select(`
          *,
          story_highlight_items(count)
        `)
        .eq('user_id', targetUserId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedHighlights = await Promise.all((data || []).map(async (highlight) => ({
        ...highlight,
        cover_image: highlight.cover_image
          ? await resolveStoryMediaUrl(highlight.cover_image).catch((error: unknown) => {
            console.warn('Could not resolve a story highlight cover:', error);
            return undefined;
          })
          : undefined,
        story_count: highlight.story_highlight_items?.[0]?.count || 0,
      })));

      setHighlights(formattedHighlights);
    } catch (err) {
      console.error('Failed to fetch highlights:', err);
      toast({ title: 'Could not load story highlights', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    void fetchHighlights();
  }, [fetchHighlights]);

  const createHighlight = async (title: string, coverImage?: string) => {
    if (!user) return;

    try {
      const coverPath = coverImage ? storyObjectPath(coverImage) || coverImage : null;
      const { data, error } = await supabase
        .from('story_highlights')
        .insert({
          user_id: user.id,
          title,
          cover_image: coverPath
        })
        .select()
        .single();

      if (error) throw error;

      await fetchHighlights();
      toast({ title: 'Highlight created' });
      return data.id;
    } catch (err: unknown) {
      toast({
        title: 'Failed to create highlight',
        description: errorMessage(err),
        variant: 'destructive'
      });
    }
  };

  const addStoryToHighlight = async (highlightId: string, storyId: string) => {
    return addStoriesToHighlight(highlightId, [storyId]);
  };

  const addStoriesToHighlight = async (highlightId: string, storyIds: string[]): Promise<boolean> => {
    if (!user || storyIds.length === 0) return false;
    try {
      const { error } = await supabase
        .from('story_highlight_items')
        .upsert(
          storyIds.map((storyId) => ({ highlight_id: highlightId, story_id: storyId })),
          { onConflict: 'highlight_id,story_id', ignoreDuplicates: true },
        );

      if (error) throw error;

      await fetchHighlights();
      toast({ title: storyIds.length === 1 ? 'Story added to highlight' : 'Stories added to highlight' });
      return true;
    } catch (err: unknown) {
      toast({
        title: 'Failed to add story',
        description: errorMessage(err),
        variant: 'destructive'
      });
      return false;
    }
  };

  const fetchHighlightStories = async (highlightId: string): Promise<Story[]> => {
    try {
      const { data, error } = await supabase
        .from('story_highlight_items')
        .select('story:stories!story_highlight_items_story_id_fkey(*, profiles(username, display_name, avatar_url))')
        .eq('highlight_id', highlightId)
        .order('added_at', { ascending: true });
      if (error) throw error;

      const highlightedStories = (data || [])
        .map((item) => item.story)
        .filter((story): story is NonNullable<typeof story> => Boolean(story));
      return await Promise.all(highlightedStories.map(async (story) => ({
        ...story,
        media_url: await resolveStoryMediaUrl(story.media_url),
        profiles: {
          username: story.profiles?.username || 'user',
          display_name: story.profiles?.display_name || 'User',
          avatar_url: story.profiles?.avatar_url || undefined,
        },
        views_count: story.views_count || 0,
        created_at: story.created_at || new Date().toISOString(),
        expires_at: story.expires_at || new Date().toISOString(),
      })));
    } catch (error) {
      console.error('Failed to load highlight stories:', error);
      toast({ title: 'Could not open this highlight', variant: 'destructive' });
      return [];
    }
  };

  const deleteHighlight = async (highlightId: string) => {
    try {
      const { error } = await supabase
        .from('story_highlights')
        .delete()
        .eq('id', highlightId);

      if (error) throw error;

      await fetchHighlights();
      toast({ title: 'Highlight deleted' });
      return true;
    } catch (err: unknown) {
      toast({
        title: 'Failed to delete highlight',
        description: errorMessage(err),
        variant: 'destructive'
      });
      return false;
    }
  };

  return {
    highlights,
    loading,
    createHighlight,
    addStoryToHighlight,
    addStoriesToHighlight,
    fetchHighlightStories,
    deleteHighlight,
    refetch: fetchHighlights
  };
};