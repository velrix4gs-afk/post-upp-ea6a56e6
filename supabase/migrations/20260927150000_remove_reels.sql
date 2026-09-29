-- Remove Reel-specific database objects. This is intentionally forward-only:
-- Reel rows, interactions, recommendation history, and saved Reel pins are
-- permanently discarded when this migration is applied.

-- Storage policies are tied to the dedicated `reels` bucket. Remove any
-- storage.objects policy that references that bucket before dropping it.
DO $$
DECLARE
  reel_policy record;
BEGIN
  FOR reel_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND concat_ws(' ', qual, with_check) ILIKE '%reels%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', reel_policy.policyname);
  END LOOP;
END
$$;

-- SQL removes Storage metadata. Purge the bucket's files through the Supabase
-- Storage API as part of rollout if the deployment does not remove the blobs
-- when their metadata rows are deleted.
DELETE FROM storage.objects WHERE bucket_id = 'reels';
DELETE FROM storage.buckets WHERE id = 'reels';

DROP FUNCTION IF EXISTS public.increment_reel_views(uuid);
DROP FUNCTION IF EXISTS public.get_recommended_reels(uuid, integer, integer);

DROP TRIGGER IF EXISTS reels_updated_at ON public.reels;
DROP FUNCTION IF EXISTS public.update_reels_updated_at();

-- Reel comment interactions depend on comments and reels; remove them first.
DROP TABLE IF EXISTS public.reel_comment_pins;
DROP TABLE IF EXISTS public.reel_comment_likes;
DROP TABLE IF EXISTS public.reel_comments;
DROP TABLE IF EXISTS public.reel_saves;
DROP TABLE IF EXISTS public.reel_reactions;
DROP TABLE IF EXISTS public.reel_views;
DROP TABLE IF EXISTS public.user_reel_interests;
DROP TABLE IF EXISTS public.reels;

-- pinned_content is shared with posts, so preserve that feature while removing
-- its Reel entries and narrowing its allowed content types.
DO $$
BEGIN
  IF to_regclass('public.pinned_content') IS NOT NULL THEN
    DELETE FROM public.pinned_content WHERE content_type = 'reel';
    ALTER TABLE public.pinned_content
      DROP CONSTRAINT IF EXISTS pinned_content_content_type_check;
    ALTER TABLE public.pinned_content
      ADD CONSTRAINT pinned_content_content_type_check
      CHECK (content_type = 'post');
  END IF;
END
$$;
