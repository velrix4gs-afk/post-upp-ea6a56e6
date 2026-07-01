import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { CacheHelper } from '@/lib/asyncStorage';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  location?: string;
  website?: string;
  birth_date?: string;
  gender?: string;
  phone?: string;
  relationship_status?: string;
  theme_color?: string;
  is_private: boolean;
  is_verified: boolean;
  verification_type?: string | null;
  verified_at?: string | null;
  online_status?: boolean;
  status_message?: string;
  created_at: string;
  updated_at: string;
}

export const useProfile = (userId?: string) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const loadProfileFromCache = async () => {
    if (!targetUserId) return;
    const cached = await CacheHelper.getProfile(targetUserId);
    if (cached) {
      setProfile(cached);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetUserId) {
      loadProfileFromCache();
      fetchProfile();

      // Set up real-time subscription for profile updates
      const channel = supabase
        .channel(`profile-${targetUserId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${targetUserId}`
          },
          (payload) => {
            console.log('[PROFILE] Real-time update:', payload);
            if (payload.new) {
              setProfile(payload.new as Profile);
              // Update cache
              CacheHelper.saveProfile(targetUserId, payload.new as Profile);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [targetUserId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // NOTE: phone and birth_date are PII and are not selectable via the
      // public profiles policy. Fetch the safe column set for everyone and
      // load the sensitive fields separately for the owner via RPC.
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, username, display_name, bio, avatar_url, cover_url, location, website, gender, relationship_status, theme_color, is_private, is_verified, verification_type, verified_at, online_status, status_message, created_at, updated_at'
        )
        .eq('id', targetUserId)
        .single();

      if (error) throw error;
      let merged: any = data;

      // Only the owner can fetch phone / birth_date.
      if (user?.id && targetUserId === user.id) {
        const { data: sensitive } = await supabase.rpc('get_my_sensitive_profile');
        const row = Array.isArray(sensitive) ? sensitive[0] : sensitive;
        if (row) {
          merged = { ...(data as any), phone: (row as any).phone ?? undefined, birth_date: (row as any).birth_date ?? undefined };
        }
      }

      setProfile(merged);

      // Cache profile
      if (targetUserId && merged) {
        await CacheHelper.saveProfile(targetUserId, merged);
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>): Promise<boolean> => {
    if (!user?.id) {
      toast({ title: 'Error', description: 'You must be logged in to update your profile', variant: 'destructive' });
      return false;
    }

    // Whitelist of allowed profile columns - prevents sending unknown fields
    const allowedFields = [
      'username',
      'display_name',
      'bio',
      'avatar_url',
      'cover_url',
      'location',
      'website',
      'birth_date',
      'gender',
      'phone',
      'relationship_status',
      'theme_color',
      'is_private'
    ];

    // Filter updates to only include allowed fields
    const filteredUpdates: Partial<Profile> = {};
    for (const key of allowedFields) {
      if (key in updates && updates[key as keyof Profile] !== undefined) {
        (filteredUpdates as any)[key] = updates[key as keyof Profile];
      }
    }

    // Add updated_at timestamp
    const updateData = {
      ...filteredUpdates,
      updated_at: new Date().toISOString()
    };

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select('id')
      .single();

    if (updateError) {
      console.error('Profile update error:', updateError);
      toast({ title: 'Error', description: updateError.message || 'Failed to update profile', variant: 'destructive' });
      return false;
    }

    if (!data) {
      toast({ title: 'Error', description: 'Profile update failed - no rows updated', variant: 'destructive' });
      return false;
    }

    // Update local state
    setProfile(prev => prev ? { ...prev, ...filteredUpdates } : null);

    // Update cache
    const cached = await CacheHelper.getProfile(user.id);
    if (cached) {
      await CacheHelper.saveProfile(user.id, { ...cached, ...filteredUpdates });
    }

    toast({ title: 'Success', description: 'Profile updated successfully' });
    return true;
  };

  const uploadCover = async (file: File) => {
    if (!user) {
      toast({
        title: 'AUTH_001',
        description: 'You must be logged in to upload a cover image',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('UPLOAD_004: File size must be less than 10MB');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('UPLOAD_005: File must be an image');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      console.log('[COVER] Uploading to path:', filePath);
      
      // Delete old cover if exists
      if (profile?.cover_url) {
        const oldPath = profile.cover_url.split('/covers/').pop();
        if (oldPath) {
          console.log('[COVER] Removing old cover:', oldPath);
          await supabase.storage.from('covers').remove([oldPath]);
        }
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('covers')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('[COVER] Upload error:', uploadError);
        throw new Error(`UPLOAD_006: ${uploadError.message}`);
      }

      console.log('[COVER] Upload successful:', uploadData);

      const { data: { publicUrl } } = supabase.storage
        .from('covers')
        .getPublicUrl(filePath);

      console.log('[COVER] Public URL:', publicUrl);

      await updateProfile({ cover_url: publicUrl });
      
      toast({
        title: 'Success',
        description: 'Cover image updated successfully!'
      });
      
      return publicUrl;
    } catch (err: any) {
      console.error('[COVER] Error:', err);
      const errorCode = err.message?.split(':')[0] || 'UPLOAD_ERROR';
      const errorMsg = err.message?.split(':')[1]?.trim() || err.message || 'Failed to upload cover image';
      
      toast({
        title: errorCode,
        description: errorMsg,
        variant: 'destructive'
      });
      throw err;
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) {
      toast({
        title: 'AUTH_001',
        description: 'You must be logged in to upload a profile picture',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('UPLOAD_001: File size must be less than 5MB');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('UPLOAD_002: File must be an image');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      console.log('[AVATAR] Uploading to path:', filePath);
      
      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/avatars/').pop();
        if (oldPath) {
          console.log('[AVATAR] Removing old avatar:', oldPath);
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('[AVATAR] Upload error:', uploadError);
        throw new Error(`UPLOAD_003: ${uploadError.message}`);
      }

      console.log('[AVATAR] Upload successful:', uploadData);

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('[AVATAR] Public URL:', publicUrl);

      await updateProfile({ avatar_url: publicUrl });
      
      toast({
        title: 'Success',
        description: 'Profile picture updated successfully!'
      });
      
      return publicUrl;
    } catch (err: any) {
      console.error('[AVATAR] Error:', err);
      const errorCode = err.message?.split(':')[0] || 'UPLOAD_ERROR';
      const errorMsg = err.message?.split(':')[1]?.trim() || err.message || 'Failed to upload profile picture';
      
      toast({
        title: errorCode,
        description: errorMsg,
        variant: 'destructive'
      });
      throw err;
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    uploadAvatar,
    uploadCover,
    refetch: fetchProfile
  };
};