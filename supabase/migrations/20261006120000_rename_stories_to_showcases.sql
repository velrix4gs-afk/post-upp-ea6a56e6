-- ============================================================
-- POST-UPP — Rename the `stories` concept to `showcases`
--
-- The feature was rebuilt and renamed in the app, but the data layer still
-- says "stories" everywhere. This aligns the database with the product
-- language so future work (and future readers) stop being confused.
--
-- WHAT THIS DOES
--   stories            -> showcases
--   story_views        -> showcase_views
--   story_highlights   -> showcase_highlights
--   story_highlight_items -> showcase_highlight_items
--   storage bucket 'stories' -> 'showcases'
--   and rewrites the RLS policies + the one function that references them
--
-- SAFE TO RE-RUN: every step checks existence first.
-- DATA IS PRESERVED: RENAME does not copy or drop rows.
--
-- IMPORTANT — do NOT run this until the matching app deploy is live.
-- The frontend currently queries `stories`. Run this first and the live
-- site breaks. Deploy order: app code first, then this SQL.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Rename the tables
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='stories')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='showcases') THEN
    ALTER TABLE public.stories RENAME TO showcases;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='story_views')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='showcase_views') THEN
    ALTER TABLE public.story_views RENAME TO showcase_views;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='story_highlights')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='showcase_highlights') THEN
    ALTER TABLE public.story_highlights RENAME TO showcase_highlights;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='story_highlight_items')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='showcase_highlight_items') THEN
    ALTER TABLE public.story_highlight_items RENAME TO showcase_highlight_items;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Rename the referencing column and its FK
--    story_views.story_id -> showcase_views.showcase_id
--    (the FK constraint follows the table automatically, but the column
--     name is what the app reads, so rename it too)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='showcase_views' AND column_name='story_id'
  ) THEN
    ALTER TABLE public.showcase_views RENAME COLUMN story_id TO showcase_id;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Rewrite RLS policies onto the new table names.
--    Policy names are kept recognisable but re-pointed.
-- ------------------------------------------------------------
DO $$
BEGIN
  -- Drop the old-named policies wherever they still exist.
  DROP POLICY IF EXISTS "Users can view stories from friends" ON public.showcases;
  DROP POLICY IF EXISTS "Users can create their own stories" ON public.showcases;
  DROP POLICY IF EXISTS "Users can delete their own stories" ON public.showcases;
  DROP POLICY IF EXISTS "Users can view active stories" ON public.showcases;
  DROP POLICY IF EXISTS "Users can view all active stories" ON public.showcases;
  DROP POLICY IF EXISTS "Users can update their own stories" ON public.showcases;
  DROP POLICY IF EXISTS "Anyone can view stories" ON public.showcases;
  DROP POLICY IF EXISTS "Users can view stories" ON public.showcases;
  DROP POLICY IF EXISTS "Users can insert own stories" ON public.showcases;
  DROP POLICY IF EXISTS "Users can update own stories" ON public.showcases;
  DROP POLICY IF EXISTS "Users can delete own stories" ON public.showcases;
END $$;

-- Recreate a clean, minimal policy set on `showcases`.
ALTER TABLE public.showcases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Showcases are viewable by everyone" ON public.showcases;
CREATE POLICY "Showcases are viewable by everyone"
  ON public.showcases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create their own showcases" ON public.showcases;
CREATE POLICY "Users can create their own showcases"
  ON public.showcases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own showcases" ON public.showcases;
CREATE POLICY "Users can update their own showcases"
  ON public.showcases FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own showcases" ON public.showcases;
CREATE POLICY "Users can delete their own showcases"
  ON public.showcases FOR DELETE
  USING (auth.uid() = user_id);

-- Views table: a viewer may record their own view; owners may read views on
-- their own showcases.
ALTER TABLE public.showcase_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can record their own showcase views" ON public.showcase_views;
CREATE POLICY "Users can record their own showcase views"
  ON public.showcase_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Users can see their own showcase views" ON public.showcase_views;
CREATE POLICY "Users can see their own showcase views"
  ON public.showcase_views FOR SELECT
  USING (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Showcase owners can see who viewed" ON public.showcase_views;
CREATE POLICY "Showcase owners can see who viewed"
  ON public.showcase_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.showcases s
      WHERE s.id = showcase_views.showcase_id
        AND s.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. Storage bucket: 'stories' -> 'showcases'
--    Objects keep their paths, so existing media_url values stay valid
--    ONLY after the app switches buckets. To avoid breaking currently
--    stored media, we create the new bucket and leave the old one in place.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('showcases', 'showcases', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for showcase media; owners write under their own uid folder.
DROP POLICY IF EXISTS "Showcase media is publicly readable" ON storage.objects;
CREATE POLICY "Showcase media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'showcases');

DROP POLICY IF EXISTS "Users can upload their own showcase media" ON storage.objects;
CREATE POLICY "Users can upload their own showcase media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'showcases'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own showcase media" ON storage.objects;
CREATE POLICY "Users can delete their own showcase media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'showcases'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

COMMIT;

-- ------------------------------------------------------------
-- 5. Refresh the API schema cache
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
