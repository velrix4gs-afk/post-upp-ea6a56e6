import { useState, useEffect, useId, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';
import { CacheHelper } from '@/lib/asyncStorage';
import { reportSilently } from '@/lib/errorSuppression';
import { useAuthReady } from './useAuthReady';
import { isProfileOwner, stripOwnerOnlyProfileFields } from '@/lib/profilePrivacy';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  location?: string;
  website?: string;
  social_links?: Record<string, string> | null;
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
  /** False for private accounts when the viewer is not an approved follower. */
  can_view_full?: boolean;
}

/**
 * True when a profile load failure is worth retrying rather than reporting.
 *
 * On a hard refresh the first request can beat session restore, and a
 * PostgREST request sent without the access token returns a permission or
 * auth error for a profile that exists. Those are transient; a genuinely
 * missing profile is not.
 */
const isTransientProfileError = (err: unknown): boolean => {
  if (!err) return false;
  const code = (err as { code?: string }).code ?? '';
  const message = String((err as { message?: string }).message ?? '').toLowerCase();
  if (code === '42501' || code === 'PGRST301' || code === '401' || code === '403') return true;
  if (message.includes('jwt') || message.includes('permission denied')) return true;
  if (message.includes('failed to fetch') || message.includes('networkerror')) return true;
  if (message.includes('timeout') || message.includes('fetch failed')) return true;
  // "Profile not found" from an empty first attempt is already retried by the
  // caller; anything else that looks like a missing row is a real answer.
  return false;
};

/**
 * Columns of `public.profiles` that every role (anon included) may read.
 *
 * Column-level SELECT is revoked on phone/birth_date/gender for all roles,
 * and on relationship_status/social_links for anon. Postgres rejects an
 * entire query with 42501 if any selected column is denied, so `select('*')`
 * always fails here. Keep this list in sync with the migrations that grant
 * column access.
 */
export const PUBLIC_PROFILE_COLUMNS =
  'id, username, display_name, avatar_url, cover_url, bio, location, website, theme_color, is_private, is_verified, verification_type, verified_at, created_at, updated_at';

export const useProfile = (userId?: string) => {
  const { user } = useAuth();
  const channelInstanceId = useId().replace(/:/g, '');
  const authReady = useAuthReady();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentTargetRef = useRef<string | undefined>(undefined);

  const targetUserId = userId || user?.id;

  const loadProfileFromCache = async () => {
    if (!targetUserId) return;
    try {
      const cached = await CacheHelper.getProfile(targetUserId);
      if (cached && currentTargetRef.current === targetUserId) {
        setProfile(cached);
        setLoading(false);
      }
    } catch (cacheError) {
      console.error('[PROFILE_CACHE] Could not read cached profile:', cacheError);
    }
  };

  useEffect(() => {
    if (currentTargetRef.current !== targetUserId) {
      setProfile(null);
      setLoading(true);
      setError(null);
    }
    currentTargetRef.current = targetUserId;
    if (targetUserId && authReady) {
      loadProfileFromCache();
      fetchProfile();

      // Set up real-time subscription for profile updates
      const targetIsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
      const channel = supabase
        .channel(`profile-${targetUserId}:${channelInstanceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `${targetIsUuid ? 'id' : 'username'}=eq.${targetUserId}`
          },
          (payload) => {
            if (!payload.new) return;
            const incoming = payload.new as Profile;
            const safe = isProfileOwner(user?.id, targetUserId)
              ? incoming
              : (stripOwnerOnlyProfileFields(incoming as unknown as Record<string, unknown>) as unknown as Profile);
            setProfile((prev) => ({ ...(prev || {}), ...safe }));
            CacheHelper.saveProfile(targetUserId, safe);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [targetUserId, authReady, channelInstanceId]);

  const fetchProfile = async (attempt = 0) => {
    const requestedTarget = targetUserId;
    // Set when this attempt schedules a retry, so the finally block below
    // leaves the skeleton up instead of flashing "Profile not found".
    let isRetrying = false;
    try {
      if (!profile) setLoading(true);
      // Public card never includes phone / birth_date / gender. The owner
      // loads those separately via get_my_sensitive_profile.
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const targetIsUuid = !!targetUserId && uuidPattern.test(targetUserId);
      type LooseResult = { data: unknown; error: unknown };
      const looseRpc = supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<LooseResult>;
      let cardResult: LooseResult = targetIsUuid && targetUserId
        ? await looseRpc.call(supabase, 'get_profile_card', { p_id: targetUserId })
        : await looseRpc.call(supabase, 'get_profile_card_by_username', { p_username: targetUserId || '' });
      if (cardResult.error) {
        // Fallback when the profile card functions are not available on the database.
        //
        // NOTE: never select('*') here. Column-level SELECT on phone/birth_date/
        // gender (and relationship_status/social_links for anon) is revoked, and
        // Postgres rejects the whole query with 42501 if ANY selected column is
        // denied. That made /profile/<username> render "Profile not found".
        // List only columns that are readable by every role.
        const fallback = await supabase
          .from('profiles')
          .select(PUBLIC_PROFILE_COLUMNS)
          .filter(targetIsUuid ? 'id' : 'username', targetIsUuid ? 'eq' : 'ilike', targetUserId || '')
          .maybeSingle();
        cardResult = { data: fallback.data, error: fallback.error };
      }
      const { data: card, error: cardError } = cardResult;
      if (cardError) throw cardError;
      if (currentTargetRef.current !== requestedTarget) return;
      const cardRow = (Array.isArray(card) ? card[0] : card) as (Profile & Record<string, unknown>) | null | undefined;
      if (!cardRow) {
        if (attempt === 0) {
          setTimeout(() => fetchProfile(1), 400);
          return;
        }
        throw new Error('Profile not found');
      }

      const merged = stripOwnerOnlyProfileFields({ ...cardRow });
      const resolvedProfileId = typeof merged.id === 'string' ? merged.id : targetUserId;
      const isOwner = isProfileOwner(user?.id, resolvedProfileId);
      if (currentTargetRef.current !== requestedTarget) return;
      setProfile(merged);

      if (targetUserId) {
        const publicCache = stripOwnerOnlyProfileFields(merged);
        await CacheHelper.saveProfile(targetUserId, publicCache);
        if (merged.username && merged.username !== targetUserId) {
          await CacheHelper.saveProfile(merged.username, publicCache);
        }
      }

      void (async () => {
        const extras: PromiseLike<unknown>[] = [];
        if (isOwner) extras.push(supabase.rpc('get_my_sensitive_profile'));
        if (merged.can_view_full !== false && resolvedProfileId) {
          // social_links is column-revoked for anon, so this must name its
          // columns too — select('*') would 401 the whole query.
          extras.push(
            supabase
              .from('profiles')
              .select('id, username, social_links')
              .eq('id', resolvedProfileId)
              .maybeSingle()
          );
        }
        const results = await Promise.all(extras);
        if (currentTargetRef.current !== requestedTarget) return;
        let index = 0;
        const updates: Partial<Profile> = {};
        if (isOwner) {
          const result = results[index++] as { data: unknown; error: unknown };
          if (result.data) {
            const rowValue = Array.isArray(result.data) ? result.data[0] : result.data;
            if (rowValue && typeof rowValue === 'object') {
              const row = rowValue as Record<string, unknown>;
              updates.phone = typeof row.phone === 'string' ? row.phone : undefined;
              updates.birth_date = typeof row.birth_date === 'string' ? row.birth_date : undefined;
              updates.gender = typeof row.gender === 'string' ? row.gender : undefined;
            }
          } else if (result.error) {
            console.error('[PROFILE_LOAD] Could not load owner-only profile fields:', result.error);
          }
        }
        if (merged.can_view_full !== false && resolvedProfileId) {
          const result = results[index] as {
            data: { social_links?: Record<string, string> | null } | null;
            error: unknown;
          };
          if (result.data) updates.social_links = result.data.social_links;
          else if (result.error) console.error('[PROFILE_LOAD] Could not load profile social links:', result.error);
        }
        if (Object.keys(updates).length > 0) {
          setProfile((current) => current?.id === resolvedProfileId ? { ...current, ...updates } : current);
          const cached = await CacheHelper.getProfile(resolvedProfileId || '');
          if (cached) await CacheHelper.saveProfile(resolvedProfileId || '', { ...cached, ...updates });
          if (merged.username) {
            const cachedByName = await CacheHelper.getProfile(merged.username);
            if (cachedByName) await CacheHelper.saveProfile(merged.username, { ...cachedByName, ...updates });
          }
        }
      })().catch((extraError) => {
        console.error('[PROFILE_LOAD] Could not load supplemental profile data:', extraError);
      });
    } catch (err: any) {
      if (currentTargetRef.current !== requestedTarget) return;
      // A hard refresh can lose the race against session restore: the RPC
      // fires before the access token is attached and comes back as a
      // transient failure. Retrying once or twice turns that into a brief
      // skeleton instead of a hard "Profile not found" on a profile that
      // plainly exists.
      const transient = attempt < 2 && isTransientProfileError(err);
      if (transient) {
        isRetrying = true;
        setTimeout(() => {
          if (currentTargetRef.current === requestedTarget) void fetchProfile(attempt + 1);
        }, 300 * (attempt + 1));
        return;
      }
      setError(err?.message ?? 'Could not load profile');
      // Silent — profile load failures are covered by the global offline
      // indicator; a repeating toast here just spams the user.
      reportSilently('PROFILE_LOAD', err);
    } finally {
      // Only settle the spinner when this attempt is final. A retry in flight
      // must keep the skeleton up rather than flash "Profile not found".
      if (currentTargetRef.current === requestedTarget && !isRetrying) {
        setLoading(false);
      }
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
      'social_links',
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
      .update(updateData as any)
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