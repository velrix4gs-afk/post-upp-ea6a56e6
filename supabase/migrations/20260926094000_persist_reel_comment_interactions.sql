CREATE UNIQUE INDEX IF NOT EXISTS idx_reel_comments_id_reel_id
  ON public.reel_comments (id, reel_id);

CREATE TABLE IF NOT EXISTS public.reel_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.reel_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.reel_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reel comment likes" ON public.reel_comment_likes;
CREATE POLICY "Anyone can view reel comment likes"
  ON public.reel_comment_likes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can like reel comments" ON public.reel_comment_likes;
CREATE POLICY "Users can like reel comments"
  ON public.reel_comment_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove their reel comment likes" ON public.reel_comment_likes;
CREATE POLICY "Users can remove their reel comment likes"
  ON public.reel_comment_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_reel_comment_likes_comment
  ON public.reel_comment_likes (comment_id);

CREATE TABLE IF NOT EXISTS public.reel_comment_pins (
  reel_id uuid PRIMARY KEY REFERENCES public.reels(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reel_comment_pins_comment_reel_fkey
    FOREIGN KEY (comment_id, reel_id)
    REFERENCES public.reel_comments(id, reel_id)
    ON DELETE CASCADE
);

ALTER TABLE public.reel_comment_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pinned reel comments" ON public.reel_comment_pins;
CREATE POLICY "Anyone can view pinned reel comments"
  ON public.reel_comment_pins FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Reel authors can pin comments" ON public.reel_comment_pins;
CREATE POLICY "Reel authors can pin comments"
  ON public.reel_comment_pins FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reels r
      WHERE r.id = reel_comment_pins.reel_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Reel authors can update pinned comments" ON public.reel_comment_pins;
CREATE POLICY "Reel authors can update pinned comments"
  ON public.reel_comment_pins FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reels r
      WHERE r.id = reel_comment_pins.reel_id
        AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reels r
      WHERE r.id = reel_comment_pins.reel_id
        AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Reel authors can unpin comments" ON public.reel_comment_pins;
CREATE POLICY "Reel authors can unpin comments"
  ON public.reel_comment_pins FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.reels r
      WHERE r.id = reel_comment_pins.reel_id
        AND r.user_id = auth.uid()
    )
  );
