CREATE TABLE IF NOT EXISTS public.reel_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, user_id)
);

ALTER TABLE public.reel_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reel saves" ON public.reel_saves;
CREATE POLICY "Users can view their own reel saves"
  ON public.reel_saves FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save reels" ON public.reel_saves;
CREATE POLICY "Users can save reels"
  ON public.reel_saves FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsave reels" ON public.reel_saves;
CREATE POLICY "Users can unsave reels"
  ON public.reel_saves FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reel_saves_user_created
  ON public.reel_saves (user_id, created_at DESC);

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stories_audience_check'
      AND conrelid = 'public.stories'::regclass
  ) THEN
    ALTER TABLE public.stories
      ADD CONSTRAINT stories_audience_check
      CHECK (audience IN ('public', 'followers', 'only-me'));
  END IF;
END
$$;

DROP POLICY IF EXISTS "Users can view stories from friends" ON public.stories;
DROP POLICY IF EXISTS "Anyone can view stories" ON public.stories;
DROP POLICY IF EXISTS "Users can view all active stories" ON public.stories;
DROP POLICY IF EXISTS "Users can view all stories" ON public.stories;
DROP POLICY IF EXISTS "Users can view active stories" ON public.stories;

CREATE POLICY "Users can view active stories by audience"
  ON public.stories FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND (
      user_id = auth.uid()
      OR audience = 'public'
      OR (
        audience = 'followers'
        AND EXISTS (
          SELECT 1
          FROM public.followers f
          WHERE f.follower_id = auth.uid()
            AND f.following_id = stories.user_id
            AND f.status = 'accepted'
        )
      )
    )
  );

UPDATE storage.buckets
SET public = false
WHERE id = 'stories';

DROP POLICY IF EXISTS "Anyone can view stories" ON storage.objects;
DROP POLICY IF EXISTS "Users can view all stories" ON storage.objects;
DROP POLICY IF EXISTS "Users can view unexpired stories" ON storage.objects;

CREATE POLICY "Users can view media for visible active stories"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'stories'
    AND EXISTS (
      SELECT 1
      FROM public.stories s
      WHERE s.expires_at > now()
        AND (
          s.user_id = auth.uid()
          OR s.audience = 'public'
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
        AND (
          s.media_url = storage.objects.name
          OR right(s.media_url, char_length(storage.objects.name)) = storage.objects.name
        )
    )
  );
