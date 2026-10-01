DROP POLICY IF EXISTS "Signed-in users can view post hashtags" ON public.post_hashtags;
CREATE POLICY "View hashtags of visible posts" ON public.post_hashtags FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_hashtags.post_id));

DROP POLICY IF EXISTS "Signed-in users can view post shares" ON public.post_shares;
CREATE POLICY "View shares of visible posts" ON public.post_shares FOR SELECT TO authenticated USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_shares.post_id) AND NOT public.is_user_blocked(user_id, auth.uid())));

DROP POLICY IF EXISTS "Signed-in users can view reposts" ON public.reposts;
CREATE POLICY "View reposts of visible posts" ON public.reposts FOR SELECT TO authenticated USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = reposts.post_id) AND NOT public.is_user_blocked(user_id, auth.uid())));

DROP POLICY IF EXISTS "Signed-in users can view reel comments" ON public.reel_comments;
CREATE POLICY "View comments on visible reels" ON public.reel_comments FOR SELECT TO authenticated USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM public.reels r WHERE r.id = reel_comments.reel_id) AND NOT public.is_user_blocked(user_id, auth.uid())));

DROP POLICY IF EXISTS "Signed-in users can view reel reactions" ON public.reel_reactions;
CREATE POLICY "View reactions on visible reels" ON public.reel_reactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM public.reels r WHERE r.id = reel_reactions.reel_id) AND NOT public.is_user_blocked(user_id, auth.uid())));

DROP POLICY IF EXISTS "Signed-in users can view highlights" ON public.story_highlights;
CREATE POLICY "View highlights of unblocked users" ON public.story_highlights FOR SELECT TO authenticated USING (auth.uid() = user_id OR NOT public.is_user_blocked(user_id, auth.uid()));

DROP POLICY IF EXISTS "Signed-in users can view highlight items" ON public.story_highlight_items;
CREATE POLICY "View items of visible highlights" ON public.story_highlight_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.story_highlights h WHERE h.id = story_highlight_items.highlight_id));