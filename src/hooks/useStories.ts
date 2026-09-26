import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { CacheHelper } from '@/lib/asyncStorage';

export interface Story {
  id: string;
  user_id: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  audience?: 'public' | 'followers' | 'only-me';
  views_count: number;
  created_at: string;
  expires_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

export const storyObjectPath = (mediaUrl: string): string | null => {
  const marker = '/storage/v1/object/public/stories/';
  const signedMarker = '/storage/v1/object/sign/stories/';
  const pathMarker = mediaUrl.includes(marker) ? marker : mediaUrl.includes(signedMarker) ? signedMarker : null;
  if (pathMarker) {
    try {
      return decodeURIComponent(mediaUrl.split(pathMarker)[1].split('?')[0]);
    } catch {
      return null;
    }
  }
  return mediaUrl.startsWith('http') ? null : mediaUrl;
};

export const resolveStoryMediaUrl = async (mediaUrl?: string | null): Promise<string | undefined> => {
  if (!mediaUrl) return undefined;
  const path = storyObjectPath(mediaUrl);
  if (!path) return mediaUrl;
  const { data, error } = await supabase.storage.from('stories').createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
};

export const useStories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles (
            username,
            display_name,
            avatar_url
          )
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      const storiesData = await Promise.all((data || []).map(async (story) => ({
        ...story,
        media_url: await resolveStoryMediaUrl(story.media_url),
      })));
      setStories(storiesData);
      await CacheHelper.saveStories(storiesData);
    } catch (err) {
      console.error('Error loading stories:', err);
      toast({
        title: 'Error',
        description: 'Failed to load stories',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      // Load cached stories first
      CacheHelper.getStories().then(cached => {
        if (cached && cached.length > 0) {
          setStories(cached);
          setLoading(false);
        }
      });

      fetchStories();
      
      // Real-time: handle INSERT/DELETE directly in state
      const channel = supabase
        .channel('stories-realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'stories'
        }, () => {
          void fetchStories();
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'stories'
        }, (payload) => {
          const deletedId = payload.old.id as string;
          setStories(prev => {
            const filtered = prev.filter(s => s.id !== deletedId);
            CacheHelper.saveStories(filtered);
            return filtered;
          });
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'stories'
        }, () => {
          void fetchStories();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchStories]);

  const createStory = async (
    content?: string,
    mediaFile?: File,
    audience: Story['audience'] = 'public',
  ): Promise<boolean> => {
    if (!user || (!content && !mediaFile)) return false;

    let uploadedPath: string | null = null;
    try {
      let media_url = null;
      let media_type = null;

      if (mediaFile) {
        if (mediaFile.size > 50 * 1024 * 1024) {
          toast({
            title: 'File Too Large',
            description: 'Story media must be less than 50MB',
            variant: 'destructive'
          });
          return false;
        }

        if (!mediaFile.type.startsWith('image/') && !mediaFile.type.startsWith('video/')) {
          toast({
            title: 'Invalid File',
            description: 'Please upload an image or video',
            variant: 'destructive'
          });
          return false;
        }

        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('stories')
          .upload(fileName, mediaFile, { upsert: false, contentType: mediaFile.type });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }
        uploadedPath = fileName;
        media_url = fileName;
        media_type = mediaFile.type.startsWith('video/') ? 'video' : 'image';
      }

      const { error } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          content,
          media_url,
          media_type,
          audience,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

      if (error) throw error;
      uploadedPath = null;

      toast({
        description: 'Story created successfully!',
      });
      
      // Real-time will handle adding to state
      return true;
    } catch (err: unknown) {
      console.error('Story creation error:', err);
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('stories').remove([uploadedPath]);
        if (cleanupError) console.error('Could not clean up unreferenced story media:', cleanupError);
      }
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to create story',
        variant: 'destructive'
      });
      return false;
    }
  };

  const viewStory = async (storyId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('story_views')
        .insert({
          story_id: storyId,
          viewer_id: user.id
        });

      if (error && !error.message.includes('duplicate')) throw error;
    } catch (err: unknown) {
      console.error('Failed to record story view:', err);
    }
  };

  const deleteStory = async (storyId: string) => {
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Story deleted successfully!',
      });
      // Real-time will handle removing from state
    } catch (err: unknown) {
      console.error('Failed to delete story:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete story',
        variant: 'destructive'
      });
    }
  };

  return {
    stories,
    loading,
    createStory,
    viewStory,
    deleteStory,
    refetch: fetchStories
  };
};
