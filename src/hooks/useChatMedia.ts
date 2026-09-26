import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface MediaItem {
  id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  sender_id: string;
}

export const useChatMedia = (chatId?: string) => {
  const { user } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMedia = useCallback(async () => {
    if (!user || !chatId) {
      setMedia([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('messages')
        .select('id, media_url, media_type, created_at, sender_id')
        .eq('chat_id', chatId)
        .not('media_url', 'is', null)
        .not('deleted_for', 'cs', `{${user.id}}`)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;
      setMedia(data || []);
    } catch (fetchError) {
      console.error('Error fetching chat media:', fetchError);
      const message = fetchError instanceof Error
        ? fetchError.message
        : typeof fetchError === 'object' && fetchError !== null && 'message' in fetchError
          ? String(fetchError.message)
          : 'Could not load shared media.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, chatId]);

  useEffect(() => {
    void fetchMedia();
  }, [fetchMedia]);

  const getImageMedia = () => media.filter(m => m.media_type?.startsWith('image'));
  const getVideoMedia = () => media.filter(m => m.media_type?.startsWith('video'));
  const getAudioMedia = () => media.filter(m => m.media_type?.startsWith('audio'));
  const getDocumentMedia = () => media.filter(m =>
    !m.media_type?.startsWith('image') &&
    !m.media_type?.startsWith('video') &&
    !m.media_type?.startsWith('audio')
  );

  return { media, loading, error, getImageMedia, getVideoMedia, getAudioMedia, getDocumentMedia, refetch: fetchMedia };
};
