import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { cache, STORES } from '@/lib/cache';

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  duration?: number;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  creator_name?: string;
  creator_avatar?: string;
  is_verified?: boolean;
  is_liked?: boolean;
}

export interface ReelComment {
  id: string;
  reel_id: string;
  user_id: string;
  content: string;
  parent_id?: string;
  created_at: string;
  likes_count?: number;
  is_liked?: boolean;
  is_pinned?: boolean;
  user?: {
    display_name: string;
    avatar_url?: string;
  };
}

export const useReels = () => {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [savedReelIds, setSavedReelIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setSavedReelIds(new Set());
      return;
    }

    const fetchSavedReels = async () => {
      const { data, error } = await supabase
        .from('reel_saves')
        .select('reel_id')
        .eq('user_id', user.id);
      if (error) {
        console.error('Error loading saved reels:', error);
        toast({ title: 'Could not load saved reels', variant: 'destructive' });
        return;
      }
      if (!cancelled) setSavedReelIds(new Set(data.map((row) => row.reel_id)));
    };

    void fetchSavedReels();
    return () => { cancelled = true; };
  }, [user]);

  const fetchReels = async (reset = false) => {
    if (!user || loading) return;
    
    try {
      setLoading(true);
      const currentPage = reset ? 0 : page;

      // Skip cache for fresh data on reset (counters change frequently)
      if (!reset) {
        const cacheKey = `reels_${currentPage}`;
        const cachedData = await cache.get(STORES.REELS, cacheKey);
        
        if (cachedData) {
          // Merge with existing reels, keeping higher counts for duplicates
          setReels(prev => {
            const existingIds = new Set(prev.map(r => r.id));
            const newReels = (cachedData as Reel[]).filter(r => !existingIds.has(r.id));
            return [...prev, ...newReels];
          });
          setPage(prev => prev + 1);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.rpc('get_recommended_reels', {
        p_user_id: user.id,
        p_page_offset: currentPage * 10,
        p_page_size: 10
      });

      if (error) throw error;

      if (data && data.length > 0) {
        // Check which reels user has liked
        const reelIds = data.map((reel) => reel.id);
        const { data: likedReels } = await supabase
          .from('reel_reactions')
          .select('reel_id')
          .eq('user_id', user.id)
          .in('reel_id', reelIds);

        const likedSet = new Set(likedReels?.map(r => r.reel_id) || []);

        const reelsWithLikes = data.map((reel) => ({
          ...reel,
          is_liked: likedSet.has(reel.id)
        }));

        // Cache the results
        const cacheKey = `reels_${currentPage}`;
        await cache.set(STORES.REELS, cacheKey, reelsWithLikes);

        if (reset) {
          setReels(reelsWithLikes);
          setPage(1);
        } else {
          // Merge: use functional update to avoid stale closure
          setReels(prev => {
            const existingMap = new Map(prev.map(r => [r.id, r]));
            reelsWithLikes.forEach((r: Reel) => {
              const existing = existingMap.get(r.id);
              if (existing) {
                // Keep highest counts to avoid regression
                existingMap.set(r.id, {
                  ...r,
                  views_count: Math.max(existing.views_count, r.views_count),
                  likes_count: Math.max(existing.likes_count, r.likes_count),
                  comments_count: Math.max(existing.comments_count, r.comments_count),
                  is_liked: existing.is_liked || r.is_liked
                });
              } else {
                existingMap.set(r.id, r);
              }
            });
            return Array.from(existingMap.values());
          });
          setPage(prev => prev + 1);
        }

        setHasMore(data.length === 10);
      } else {
        setHasMore(false);
      }
    } catch (error: unknown) {
      console.error('Error fetching reels:', error);
      toast({
        title: 'Failed to load reels',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createReel = async (videoFile: File, caption?: string) => {
    if (!user) return null;

    try {
      // Get video duration
      const duration = await getVideoDuration(videoFile);

      // Upload video
      const videoPath = `${user.id}/${Date.now()}_${videoFile.name}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('reels')
        .upload(videoPath, videoFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('reels')
        .getPublicUrl(videoPath);

      // Create reel record
      const { data: reel, error: insertError } = await supabase
        .from('reels')
        .insert({
          user_id: user.id,
          video_url: publicUrl,
          caption,
          duration: Math.floor(duration)
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Extract and save hashtags for interests
      if (caption) {
        const hashtags = caption.match(/#\w+/g);
        if (hashtags) {
          for (const tag of hashtags) {
            await supabase.from('user_reel_interests').upsert({
              user_id: user.id,
              hashtag: tag.toLowerCase(),
              interest_score: 1
            }, {
              onConflict: 'user_id,hashtag'
            });
          }
        }
      }

      toast({
        title: 'Reel created!',
        description: 'Your reel has been posted successfully'
      });

      return reel;
    } catch (error: unknown) {
      console.error('Error creating reel:', error);
      toast({
        title: 'Failed to create reel',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive'
      });
      return null;
    }
  };

  const viewReel = async (reelId: string, watchDuration: number, completed: boolean) => {
    if (!user) return;

    try {
      // Record view
      await supabase.from('reel_views').upsert({
        reel_id: reelId,
        user_id: user.id,
        watch_duration: watchDuration,
        completed
      }, {
        onConflict: 'reel_id,user_id'
      });

      // Increment view count
      await supabase.rpc('increment_reel_views', { reel_id: reelId });

      // Update local state
      setReels(prev => prev.map(r => 
        r.id === reelId ? { ...r, views_count: r.views_count + 1 } : r
      ));

      // Track interest if completed
      if (completed) {
        const reel = reels.find(r => r.id === reelId);
        if (reel) {
          await supabase.from('user_reel_interests').upsert({
            user_id: user.id,
            creator_id: reel.user_id,
            interest_score: 1
          }, {
            onConflict: 'user_id,creator_id'
          });
        }
      }
    } catch (error) {
      console.error('Error recording view:', error);
    }
  };

  const likeReel = async (reelId: string) => {
    if (!user) return;

    const reel = reels.find(r => r.id === reelId);
    if (!reel) return;

    // Optimistic update first
    const wasLiked = reel.is_liked;
    const newLikesCount = wasLiked 
      ? Math.max(0, reel.likes_count - 1)  // Prevent negative counts
      : reel.likes_count + 1;

    setReels(prev => prev.map(r =>
      r.id === reelId
        ? { ...r, is_liked: !wasLiked, likes_count: newLikesCount }
        : r
    ));

    try {
      if (wasLiked) {
        // Unlike
        const { error } = await supabase
          .from('reel_reactions')
          .delete()
          .eq('reel_id', reelId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        // Like - use upsert to prevent duplicates
        const { error } = await supabase.from('reel_reactions').upsert({
          reel_id: reelId,
          user_id: user.id,
          reaction_type: 'like'
        }, {
          onConflict: 'reel_id,user_id'
        });
        if (error) throw error;
      }
    } catch (error: unknown) {
      // Revert optimistic update on error
      setReels(prev => prev.map(r =>
        r.id === reelId
          ? { ...r, is_liked: wasLiked, likes_count: reel.likes_count }
          : r
      ));
      console.error('Error toggling like:', error);
      toast({
        title: 'Failed to like reel',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const toggleSaveReel = async (reelId: string) => {
    if (!user) {
      toast({ title: 'Sign in to save reels', variant: 'destructive' });
      return false;
    }

    const wasSaved = savedReelIds.has(reelId);
    setSavedReelIds((previous) => {
      const next = new Set(previous);
      if (wasSaved) next.delete(reelId);
      else next.add(reelId);
      return next;
    });

    try {
      const result = wasSaved
        ? await supabase.from('reel_saves').delete().eq('reel_id', reelId).eq('user_id', user.id)
        : await supabase.from('reel_saves').insert({ reel_id: reelId, user_id: user.id });
      if (result.error) throw result.error;
      toast({ title: wasSaved ? 'Removed from saved reels' : 'Saved reel' });
      return true;
    } catch (error) {
      setSavedReelIds((previous) => {
        const next = new Set(previous);
        if (wasSaved) next.add(reelId);
        else next.delete(reelId);
        return next;
      });
      console.error('Error saving reel:', error);
      toast({ title: 'Could not update saved reels', variant: 'destructive' });
      return false;
    }
  };

  const fetchComments = async (reelId: string) => {
    try {
      const { data, error } = await supabase
        .from('reel_comments')
        .select(`
          *,
          user:profiles(display_name, avatar_url)
        `)
        .eq('reel_id', reelId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const comments = data || [];
      const commentIds = comments.map((comment) => comment.id);
      const [{ data: likeRows, error: likesError }, { data: pinRow, error: pinError }] = await Promise.all([
        commentIds.length
          ? supabase.from('reel_comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('reel_comment_pins').select('comment_id').eq('reel_id', reelId).maybeSingle(),
      ]);
      if (likesError) throw likesError;
      if (pinError) throw pinError;

      const likesByComment = new Map<string, { count: number; likedByUser: boolean }>();
      (likeRows || []).forEach((like) => {
        const current = likesByComment.get(like.comment_id) || { count: 0, likedByUser: false };
        current.count += 1;
        if (like.user_id === user?.id) current.likedByUser = true;
        likesByComment.set(like.comment_id, current);
      });

      return comments.map((comment) => ({
        ...comment,
        likes_count: likesByComment.get(comment.id)?.count || 0,
        is_liked: likesByComment.get(comment.id)?.likedByUser || false,
        is_pinned: pinRow?.comment_id === comment.id,
      })) as ReelComment[];
    } catch (error: unknown) {
      console.error('Error fetching comments:', error);
      toast({ title: 'Could not load comments', variant: 'destructive' });
      return [];
    }
  };

  const addComment = async (reelId: string, content: string, parentId?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('reel_comments')
        .insert({
          reel_id: reelId,
          user_id: user.id,
          content,
          parent_id: parentId
        })
        .select()
        .single();

      if (error) throw error;

      // Update comments count
      setReels(prev => prev.map(r =>
        r.id === reelId ? { ...r, comments_count: r.comments_count + 1 } : r
      ));

      return data;
    } catch (error: unknown) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Failed to add comment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive'
      });
      return null;
    }
  };

  const deleteReel = async (reelId: string) => {
    if (!user) return;

    try {
      const reel = reels.find(r => r.id === reelId);
      if (!reel || reel.user_id !== user.id) return;

      // Delete from storage
      const path = reel.video_url.split('/reels/')[1];
      if (path) {
        const { error: storageError } = await supabase.storage.from('reels').remove([path]);
        if (storageError) throw storageError;
      }

      // Delete from database
      const { error: deleteError } = await supabase.from('reels').delete().eq('id', reelId);
      if (deleteError) throw deleteError;

      setReels(prev => prev.filter(r => r.id !== reelId));

      toast({
        title: 'Reel deleted',
        description: 'Your reel has been removed'
      });
    } catch (error: unknown) {
      console.error('Error deleting reel:', error);
      toast({
        title: 'Failed to delete reel',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive'
      });
    }
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objectUrl = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        if (!Number.isFinite(video.duration)) {
          reject(new Error('Could not read reel duration.'));
          return;
        }
        resolve(video.duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read the selected video.'));
      };
      video.src = objectUrl;
    });
  };

  useEffect(() => {
    if (user) {
      fetchReels(true);
    }
  }, [user]);

  return {
    reels,
    loading,
    hasMore,
    savedReelIds,
    fetchReels,
    createReel,
    viewReel,
    likeReel,
    toggleSaveReel,
    fetchComments,
    addComment,
    deleteReel
  };
};
