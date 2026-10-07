-- ============================================================
-- POST-UPP — Fix the fallout from the stories -> showcases rename
--
-- Migration 20261006120000 renamed the tables but left three things
-- pointing at the old name, and flattened the audience rules. Symptoms
-- this fixes:
--
--   1. "could not find public.stories in schema cache" when posting a
--      Showcase, because the storage read policy still queried
--      public.stories, which no longer exists. Storage then rejected the
--      upload/list and the item never appeared.
--   2. Showcase media silently dropped by the client, which discards any
--      row whose media cannot be resolved.
--   3. A PRIVACY REGRESSION: the rename replaced the per-audience SELECT
--      policy with USING (true), so 'followers' and 'only-me' Showcases
--      became visible to everyone.
--   4. New Showcases not appearing until a manual reload, because the
--      realtime publication / replica identity were only ever set on the
--      old table name.
--
-- SAFE TO RE-RUN: every step checks existence first.
-- NO DATA IS TOUCHED: policies, grants, publication membership only.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Storage read policy for Showcase media.
--    Was: bucket_id = 'stories' AND EXISTS (SELECT 1 FROM public.stories s ...)
--    Now: the same intent, against public.showcases, and honouring the
--    audience column so a private Showcase's file is not readable by
--    anyone who guesses the path.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view media for visible stories and highlights" ON storage.objects;
DROP POLICY IF EXISTS "Users can view media for visible showcases and highlights" ON storage.objects;

CREATE POLICY "Users can view media for visible showcases and highlights"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'stories'
    AND EXISTS (
      SELECT 1
      FROM public.showcases s
      WHERE (
        s.media_url = storage.objects.name
        OR right(s.media_url, char_length(storage.objects.name)) = storage.objects.name
      )
        AND (
          s.expires_at > now()
          OR EXISTS (
            SELECT 1
            FROM public.showcase_highlight_items hi
            JOIN public.showcase_highlights h ON h.id = hi.highlight_id
            -- NOTE: this column kept its original name. The rename migration
            -- only renamed story_views.story_id -> showcase_id; highlight items
            -- were left alone, so it is still story_id here.
            WHERE hi.story_id = s.id
              AND h.user_id = s.user_id
          )
        )
        AND (
          s.user_id = auth.uid()
          OR s.audience = 'public'
          OR s.audience IS NULL
          OR (
            s.audience = 'followers'
            AND EXISTS (
              SELECT 1
              FROM public.followers f
              WHERE f.follower_id = auth.uid()
                AND f.following_id = s.user_id
                AND f.status = 'accepted'
            )
          )
        )
    )
  );

-- The old policy on the empty 'showcases' bucket is fine to keep; it makes
-- that bucket readable too, which costs nothing while it holds no objects.

-- ------------------------------------------------------------
-- 2. Restore the audience rules on the table itself.
--    The rename set USING (true), which made every private Showcase
--    world-readable.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Showcases are viewable by everyone" ON public.showcases;
DROP POLICY IF EXISTS "Users can view showcases by audience" ON public.showcases;

CREATE POLICY "Users can view showcases by audience"
  ON public.showcases FOR SELECT
  USING (
    (
      expires_at > now()
      OR EXISTS (
        SELECT 1
        FROM public.showcase_highlight_items hi
        JOIN public.showcase_highlights h ON h.id = hi.highlight_id
        WHERE hi.story_id = showcases.id
          AND h.user_id = showcases.user_id
      )
    )
    AND (
      user_id = auth.uid()
      OR audience = 'public'
      OR audience IS NULL
      OR (
        audience = 'followers'
        AND EXISTS (
          SELECT 1
          FROM public.followers f
          WHERE f.follower_id = auth.uid()
            AND f.following_id = showcases.user_id
            AND f.status = 'accepted'
        )
      )
    )
  );

-- ------------------------------------------------------------
-- 3. Realtime: make new Showcases reach the feed without a reload.
--    Only ever set on the old table name.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'showcases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.showcases;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'showcase_views'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.showcase_views;
  END IF;
END $$;

-- DELETE events need the full old row to know which item to drop.
ALTER TABLE public.showcases REPLICA IDENTITY FULL;

COMMIT;

-- Refresh the PostgREST schema cache so the stale public.stories
-- reference stops being reported.
NOTIFY pgrst, 'reload schema';
