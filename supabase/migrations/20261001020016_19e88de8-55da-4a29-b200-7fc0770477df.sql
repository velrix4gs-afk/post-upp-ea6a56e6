-- 1. user_presence: visible to self, chat partners, and people you follow
DROP POLICY IF EXISTS "Authenticated users can view presence" ON public.user_presence;
CREATE POLICY "Users can view presence of connections"
ON public.user_presence
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_participants cp1
    JOIN public.chat_participants cp2 ON cp1.chat_id = cp2.chat_id
    WHERE cp1.user_id = auth.uid() AND cp2.user_id = user_presence.user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = auth.uid() AND f.following_id = user_presence.user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.followers fl
    WHERE fl.follower_id = auth.uid() AND fl.following_id = user_presence.user_id
  )
);

-- 2. pages: signed-in only (contact_email no longer public)
DROP POLICY IF EXISTS "Pages are viewable by everyone" ON public.pages;
DROP POLICY IF EXISTS "Users can view pages" ON public.pages;
CREATE POLICY "Signed-in users can view pages"
ON public.pages
FOR SELECT
TO authenticated
USING (true);

-- 3. Social tables: readable by signed-in users only
DROP POLICY IF EXISTS "Users can view all comment likes" ON public.comment_likes;
CREATE POLICY "Signed-in users can view comment likes" ON public.comment_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view pinned content" ON public.pinned_content;
CREATE POLICY "Signed-in users can view pinned content" ON public.pinned_content FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view pinned posts" ON public.pinned_posts;
CREATE POLICY "Signed-in users can view pinned posts" ON public.pinned_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view post hashtags" ON public.post_hashtags;
CREATE POLICY "Signed-in users can view post hashtags" ON public.post_hashtags FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view hashtags" ON public.hashtags;
CREATE POLICY "Signed-in users can view hashtags" ON public.hashtags FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view highlights" ON public.story_highlights;
CREATE POLICY "Signed-in users can view highlights" ON public.story_highlights FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view highlight items" ON public.story_highlight_items;
CREATE POLICY "Signed-in users can view highlight items" ON public.story_highlight_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view reposts" ON public.reposts;
CREATE POLICY "Signed-in users can view reposts" ON public.reposts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view reel reactions" ON public.reel_reactions;
CREATE POLICY "Signed-in users can view reel reactions" ON public.reel_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view reel comments" ON public.reel_comments;
CREATE POLICY "Signed-in users can view reel comments" ON public.reel_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view reels" ON public.reels;
DROP POLICY IF EXISTS "Anyone can view published reels" ON public.reels;
CREATE POLICY "Signed-in users can view reels" ON public.reels FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view post shares" ON public.post_shares;
DROP POLICY IF EXISTS "Users can view shares" ON public.post_shares;
CREATE POLICY "Signed-in users can view post shares" ON public.post_shares FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Page followers are viewable by everyone" ON public.page_followers;
CREATE POLICY "Signed-in users can view page followers" ON public.page_followers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view page members" ON public.page_members;
CREATE POLICY "Signed-in users can view page members" ON public.page_members FOR SELECT TO authenticated USING (true);

-- 4. Remove loose insert rules (owner-scoped rules already exist)
DROP POLICY IF EXISTS "Chats insert" ON public.chats;
DROP POLICY IF EXISTS "users_can_create_chats" ON public.chats;
DROP POLICY IF EXISTS "Groups insert" ON public.groups;

-- 5. Storage: bind group-images writes to the uploader's own folder
DROP POLICY IF EXISTS "Authenticated users can upload group images" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can upload group images" ON storage.objects;
DROP POLICY IF EXISTS "Group members can upload group images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update group images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete group images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view group images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view posts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view all stories" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own post media" ON storage.objects;

CREATE POLICY "group_images_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'group-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "group_images_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'group-images' AND (storage.foldername(name))[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'group-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "group_images_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'group-images' AND (storage.foldername(name))[1] = (auth.uid())::text);