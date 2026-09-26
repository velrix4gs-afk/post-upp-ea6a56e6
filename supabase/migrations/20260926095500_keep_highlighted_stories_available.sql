DROP POLICY IF EXISTS "Users can view active stories by audience" ON public.stories;
CREATE POLICY "Users can view active or highlighted stories by audience"
  ON public.stories FOR SELECT TO authenticated
  USING (
    (
      expires_at > now()
      OR EXISTS (
        SELECT 1
        FROM public.story_highlight_items hi
        JOIN public.story_highlights h ON h.id = hi.highlight_id
        WHERE hi.story_id = stories.id
          AND h.user_id = stories.user_id
      )
    )
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

DROP POLICY IF EXISTS "Users can view media for visible active stories" ON storage.objects;
CREATE POLICY "Users can view media for visible stories and highlights"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'stories'
    AND EXISTS (
      SELECT 1
      FROM public.stories s
      WHERE (
        s.media_url = storage.objects.name
        OR right(s.media_url, char_length(storage.objects.name)) = storage.objects.name
      )
        AND (
          s.expires_at > now()
          OR EXISTS (
            SELECT 1
            FROM public.story_highlight_items hi
            JOIN public.story_highlights h ON h.id = hi.highlight_id
            WHERE hi.story_id = s.id
              AND h.user_id = s.user_id
          )
        )
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
    )
  );
