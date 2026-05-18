
-- 1. Remove sensitive tables from realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='email_otps') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.email_otps';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='error_logs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.error_logs';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='rate_limits') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.rate_limits';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='users') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.users';
  END IF;
END $$;

-- 2. Fix broken INSERT policy on messages
DROP POLICY IF EXISTS chat_members_can_insert_messages ON public.messages;
DROP POLICY IF EXISTS "authenticated can receive" ON public.messages;
DROP POLICY IF EXISTS "authenticated can send" ON public.messages;

-- 3. Tighten storage policy for messages bucket: only chat participants
DROP POLICY IF EXISTS "Chat participants can view messages" ON storage.objects;

CREATE POLICY "Chat participants can view message files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'messages'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.user_id = auth.uid()
        AND cp.chat_id::text = (storage.foldername(name))[1]
    )
  )
);

-- 4. Hide phone/birth_date on profiles from unauthenticated (anon) users
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, username, display_name, bio, avatar_url, cover_url, location, website,
  relationship_status, is_verified, is_private, theme_color, last_seen,
  created_at, updated_at, gender, full_name, is_active, is_profile_complete,
  verification_type, verified_at, verification_note
) ON public.profiles TO anon;

-- 5. Hide contact_email on pages from unauthenticated users
REVOKE SELECT ON public.pages FROM anon;
GRANT SELECT (
  id, name, username, description, category, avatar_url, cover_url,
  website_url, is_verified, is_official, created_by, followers_count,
  created_at, updated_at
) ON public.pages TO anon;
