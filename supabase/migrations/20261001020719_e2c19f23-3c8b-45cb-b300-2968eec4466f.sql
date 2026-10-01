DROP POLICY IF EXISTS "Signed-in users can view comment likes" ON public.comment_likes;
CREATE POLICY "Users can view their own comment likes" ON public.comment_likes FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signed-in users can view page members" ON public.page_members;
CREATE POLICY "Page members can view page members" ON public.page_members FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_page_member(page_id, auth.uid()));

DROP POLICY IF EXISTS "Signed-in users can view page followers" ON public.page_followers;
CREATE POLICY "Users and page members can view page followers" ON public.page_followers FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_page_member(page_id, auth.uid()));

DROP POLICY IF EXISTS "Signed-in users can view pinned content" ON public.pinned_content;
CREATE POLICY "Users can view their own pinned content" ON public.pinned_content FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signed-in users can view pinned posts" ON public.pinned_posts;
CREATE POLICY "Users can view their own pinned posts" ON public.pinned_posts FOR SELECT TO authenticated USING (auth.uid() = user_id);