import { useState, useEffect } from 'react';
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
  views_count: number;
  created_at: string;
  expires_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

export const useStories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

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
        }, async (payload) => {
          const newStory = payload.new as any;
          
          // Fetch profile for the new story
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, display_name, avatar_url')
            .eq('id', newStory.user_id)
            .single();

          const storyWithProfile: Story = {
            ...newStory,
            profiles: profile || { username: 'unknown', display_name: 'Unknown' }
          };

          setStories(prev => {
            if (prev.some(s => s.id === storyWithProfile.id)) return prev;
            const updated = [storyWithProfile, ...prev];
            CacheHelper.saveStories(updated);
            return updated;
          });
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'stories'
        }, (payload) => {
          const deletedId = (payload.old as any).id;
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
        }, (payload) => {
          const updated = payload.new as any;
          setStories(prev => {
            const newStories = prev.map(s => s.id === updated.id ? { ...s, ...updated } : s);
            CacheHelper.saveStories(newStories);
            return newStories;
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchStories = async () => {
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
      const storiesData = data || [];
      setStories(storiesData);
      CacheHelper.saveStories(storiesData);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to load stories',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createStory = async (content?: string, mediaFile?: File) => {
    if (!user || (!content && !mediaFile)) return;

    try {
      let media_url = null;
      let media_type = null;

      if (mediaFile) {
        if (mediaFile.size > 10 * 1024 * 1024) {
          toast({
            title: 'File Too Large',
            description: 'Story media must be less than 10MB',
            variant: 'destructive'
          });
          return;
        }

        if (!mediaFile.type.startsWith('image/') && !mediaFile.type.startsWith('video/')) {
          toast({
            title: 'Invalid File',
            description: 'Please upload an image or video',
            variant: 'destructive'
          });
          return;
        }

        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('stories')
          .upload(fileName, mediaFile, { upsert: false, contentType: mediaFile.type });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Failed to upload file');
        }

        const { data: { publicUrl } } = supabase.storage
          .from('stories')
          .getPublicUrl(fileName);

        media_url = publicUrl;
        media_type = mediaFile.type.startsWith('video/') ? 'video' : 'image';
      }

      const { error } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          content,
          media_url,
          media_type
        });

      if (error) throw error;

      toast({
        description: 'Story created successfully!',
      });
      
      // Real-time will handle adding to state
    } catch (err: any) {
      console.error('Story creation error:', err);
      toast({
        title: 'Error',
        description: 'Failed to create story',
        variant: 'destructive'
      });
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
    } catch (err: any) {
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
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete story',
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
