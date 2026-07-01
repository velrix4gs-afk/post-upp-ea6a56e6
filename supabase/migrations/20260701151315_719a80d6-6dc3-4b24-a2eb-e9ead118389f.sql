
DROP POLICY IF EXISTS "Users can view media" ON public.media;
CREATE POLICY "Users can view media" ON public.media FOR SELECT
USING (
  post_id IS NULL OR user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = media.post_id AND (
    p.is_public = true OR p.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.friendships f WHERE ((f.requester_id=auth.uid() AND f.addressee_id=p.user_id) OR (f.addressee_id=auth.uid() AND f.requester_id=p.user_id)) AND f.status='accepted')
  ))
);

DROP POLICY IF EXISTS "Users can view comments" ON public.comments;
CREATE POLICY "Users can view comments" ON public.comments FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND (
    p.is_public = true OR p.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.friendships f WHERE ((f.requester_id=auth.uid() AND f.addressee_id=p.user_id) OR (f.addressee_id=auth.uid() AND f.requester_id=p.user_id)) AND f.status='accepted')
  ))
);

DROP POLICY IF EXISTS "Users can view comments on visible posts" ON public.post_comments;
CREATE POLICY "Users can view comments on visible posts" ON public.post_comments FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND (
    p.is_public = true OR p.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.friendships f WHERE ((f.requester_id=auth.uid() AND f.addressee_id=p.user_id) OR (f.addressee_id=auth.uid() AND f.requester_id=p.user_id)) AND f.status='accepted')
  ))
);

DROP POLICY IF EXISTS "Users can view post reactions" ON public.post_reactions;
CREATE POLICY "Users can view post reactions" ON public.post_reactions FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_reactions.post_id AND (
    p.is_public = true OR p.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.friendships f WHERE ((f.requester_id=auth.uid() AND f.addressee_id=p.user_id) OR (f.addressee_id=auth.uid() AND f.requester_id=p.user_id)) AND f.status='accepted')
  ))
);

DROP POLICY IF EXISTS "Users can view all likes" ON public.likes;
CREATE POLICY "Users can view likes on visible posts" ON public.likes FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = likes.post_id AND (
    p.is_public = true OR p.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.friendships f WHERE ((f.requester_id=auth.uid() AND f.addressee_id=p.user_id) OR (f.addressee_id=auth.uid() AND f.requester_id=p.user_id)) AND f.status='accepted')
  ))
);

DROP POLICY IF EXISTS "Users can view all reactions" ON public.reactions;
CREATE POLICY "Users can view reactions on visible targets" ON public.reactions FOR SELECT
USING (
  target_type <> 'post'
  OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = reactions.target_id AND (
    p.is_public = true OR p.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.friendships f WHERE ((f.requester_id=auth.uid() AND f.addressee_id=p.user_id) OR (f.addressee_id=auth.uid() AND f.requester_id=p.user_id)) AND f.status='accepted')
  ))
);

REVOKE SELECT (phone, birth_date) ON public.profiles FROM anon;
REVOKE SELECT (phone, birth_date) ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_sensitive_profile()
RETURNS TABLE (phone text, birth_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.phone, p.birth_date FROM public.profiles p WHERE p.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_sensitive_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_sensitive_profile() TO authenticated;

DROP VIEW IF EXISTS public.profiles_view;
CREATE VIEW public.profiles_view AS
SELECT p.id, p.username, p.display_name, p.bio, p.avatar_url, p.cover_url,
    p.location, p.website, p.relationship_status, p.theme_color,
    p.is_private, p.is_verified, p.last_seen, p.created_at, p.updated_at,
    us.notification_messages, us.notification_friend_requests, us.notification_post_reactions,
    us.privacy_who_can_message, us.privacy_who_can_view_profile
FROM public.profiles p
LEFT JOIN public.user_settings us ON p.id = us.user_id;
GRANT SELECT ON public.profiles_view TO authenticated, anon, service_role;
