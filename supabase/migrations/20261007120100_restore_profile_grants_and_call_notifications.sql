-- ============================================================
-- POST-UPP — Restore column access and stop call summaries leaking
--                into notifications as raw JSON
--
-- TWO INDEPENDENT FIXES
--
-- 1. profiles column grants.
--    20260903003648 revoked SELECT on public.profiles from authenticated
--    and re-granted an explicit column list. `social_links` was added
--    LATER (20261005004545), so it was never in that list — and Postgres
--    rejects an entire query with 42501 if ANY selected column is denied.
--
--    The visible symptom: editing your profile and adding a social link
--    silently fails. useProfile.updateProfile() ends with
--    .select('id').single(), and the app's profile reads name
--    social_links, so the whole round-trip errors out and the save is
--    discarded. The same applies to phone, birth_date, gender and
--    relationship_status, which are also in the app's Profile interface.
--
--    Fix: grant exactly the columns the app reads. Owner-only columns
--    stay out of the anon grant. Sensitive PII (phone/birth_date/gender)
--    is granted to `authenticated` only, which is already how those are
--    meant to be read back through get_my_sensitive_profile(); the table
--    RLS still limits which ROWS are visible.
--
-- 2. Missed-call notifications.
--    CallSessionProvider stores a call summary as
--    {"kind":"voice","status":"missed","durationSec":0} with
--    media_type='call'. The chat bubble parses that correctly via
--    src/lib/callRecord.ts, but notify_new_message() copied
--    NEW.content verbatim into notifications.content — so the
--    notification and browser push showed raw JSON.
--
--    Fix: when media_type = 'call', render a readable sentence instead.
--
-- SAFE TO RE-RUN. No rows are modified.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. profiles column grants
-- ------------------------------------------------------------

-- Columns every signed-in user may read back. social_links is the one
-- that was missing and broke profile editing.
GRANT SELECT (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  cover_url,
  location,
  website,
  relationship_status,
  social_links,
  is_verified,
  is_private,
  theme_color,
  last_seen,
  created_at,
  updated_at,
  full_name,
  is_active,
  is_profile_complete,
  verification_type,
  verified_at,
  verification_note
) ON public.profiles TO authenticated;

-- Sensitive PII the owner reads through their own session. RLS still
-- restricts these to rows the requester is allowed to see.
GRANT SELECT (phone, birth_date, gender) ON public.profiles TO authenticated;

-- Anon gets the public card only. Deliberately NO social_links, no
-- relationship_status, no PII: a logged-out visitor does not need them,
-- and the profile card path goes through get_profile_card().
GRANT SELECT (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  cover_url,
  location,
  website,
  is_verified,
  is_private,
  theme_color,
  created_at,
  updated_at,
  verification_type,
  verified_at
) ON public.profiles TO anon;

-- ------------------------------------------------------------
-- 2. Call summaries read as sentences, not JSON
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sender_name text;
  preview text;
  call_kind text;
  call_status text;
  call_seconds integer;
  rec record;
BEGIN
  -- Skip system / deleted messages
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF NEW.media_type = 'call' THEN
    -- A call summary row. Render it as text: the raw content is a JSON
    -- blob meant for the in-app call bubble, not for a notification.
    BEGIN
      call_kind := NULLIF(NEW.content::jsonb ->> 'kind', '');
      call_status := NULLIF(NEW.content::jsonb ->> 'status', '');
      call_seconds := COALESCE((NEW.content::jsonb ->> 'durationSec')::numeric, 0)::integer;
    EXCEPTION WHEN others THEN
      -- Content was not valid JSON after all. Fall through to the
      -- generic preview rather than failing the whole insert.
      call_kind := NULL;
      call_status := NULL;
      call_seconds := 0;
    END;

    IF call_kind IS NOT NULL THEN
      preview :=
        CASE
          WHEN call_status = 'completed' THEN
            'Call ended · ' || (call_seconds / 60) || ':' || lpad((call_seconds % 60)::text, 2, '0')
          WHEN call_status = 'declined' THEN
            'Declined ' || call_kind || ' call'
          WHEN call_status IN ('missed', 'unanswered') THEN
            'Missed ' || call_kind || ' call'
          WHEN call_status IN ('incoming', 'outgoing') THEN
            initcap(call_status) || ' ' || call_kind || ' call'
          ELSE
            initcap(call_kind) || ' call'
        END;
    ELSE
      preview := 'Call';
    END IF;
  ELSE
    preview := COALESCE(NULLIF(NEW.content, ''), 'Sent an attachment');
  END IF;

  -- One notification per recipient (chat participants excluding sender)
  FOR rec IN
    SELECT cp.user_id
    FROM public.chat_participants cp
    WHERE cp.chat_id = NEW.chat_id
      AND cp.user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, content, data)
    VALUES (
      rec.user_id,
      'message',
      COALESCE(sender_name, 'New message'),
      preview,
      jsonb_build_object('chat_id', NEW.chat_id, 'sender_id', NEW.sender_id, 'message_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
