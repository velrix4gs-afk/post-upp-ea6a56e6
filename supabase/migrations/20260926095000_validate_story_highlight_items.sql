DROP POLICY IF EXISTS "Users can manage their highlight items" ON public.story_highlight_items;

CREATE POLICY "Users can add their own stories to highlights"
  ON public.story_highlight_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.story_highlights h
      JOIN public.stories s ON s.id = story_highlight_items.story_id
      WHERE h.id = story_highlight_items.highlight_id
        AND h.user_id = auth.uid()
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own highlight items"
  ON public.story_highlight_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.story_highlights h
      WHERE h.id = story_highlight_items.highlight_id
        AND h.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.story_highlights h
      JOIN public.stories s ON s.id = story_highlight_items.story_id
      WHERE h.id = story_highlight_items.highlight_id
        AND h.user_id = auth.uid()
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove their own highlight items"
  ON public.story_highlight_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.story_highlights h
      WHERE h.id = story_highlight_items.highlight_id
        AND h.user_id = auth.uid()
    )
  );
