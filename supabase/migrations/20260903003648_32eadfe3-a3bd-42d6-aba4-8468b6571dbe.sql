-- 1. profiles PII
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, display_name, bio, avatar_url, cover_url, location, website, relationship_status, is_verified, is_private, theme_color, last_seen, created_at, updated_at, full_name, is_active, is_profile_complete, verification_type, verified_at, verification_note) ON public.profiles TO authenticated;

-- 2. media unattached exposure
DROP POLICY IF EXISTS "Users can view media" ON public.media;
CREATE POLICY "Users can view media" ON public.media FOR SELECT USING (
  (user_id = auth.uid())
  OR (post_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = media.post_id AND (
      p.is_public = true
      OR p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.friendships f
        WHERE (((f.requester_id = auth.uid() AND f.addressee_id = p.user_id)
             OR (f.addressee_id = auth.uid() AND f.requester_id = p.user_id)))
          AND f.status = 'accepted'
      )
    )
  ))
);

-- 3. posts privacy bypass
DROP POLICY IF EXISTS "posts_select_non_deleted" ON public.posts;
DROP POLICY IF EXISTS "Allow edge select" ON public.posts;
DROP POLICY IF EXISTS "Allow edge insert" ON public.posts;
DROP POLICY IF EXISTS "Allow edge update" ON public.posts;
DROP POLICY IF EXISTS "Users can view all public and friends posts" ON public.posts;
CREATE POLICY "Users can view all public and friends posts" ON public.posts FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND is_deleted = false
  AND (
    privacy = 'public'
    OR user_id = auth.uid()
    OR (privacy = 'friends' AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE (((f.requester_id = auth.uid() AND f.addressee_id = posts.user_id)
           OR (f.addressee_id = auth.uid() AND f.requester_id = posts.user_id)))
        AND f.status = 'accepted'
    ))
  )
);

-- 4. reactions on non-post targets
DROP POLICY IF EXISTS "Users can view reactions on visible targets" ON public.reactions;
CREATE POLICY "Users can view reactions on visible targets" ON public.reactions FOR SELECT USING (
  user_id = auth.uid()
  OR (target_type = 'post' AND EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = reactions.target_id AND (
      p.is_public = true OR p.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.friendships f
        WHERE (((f.requester_id = auth.uid() AND f.addressee_id = p.user_id)
             OR (f.addressee_id = auth.uid() AND f.requester_id = p.user_id)))
          AND f.status = 'accepted')
    )
  ))
  OR (target_type = 'message' AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = reactions.target_id
      AND public.is_chat_participant(m.chat_id, auth.uid())
  ))
  OR (target_type = 'comment' AND EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.posts p ON p.id = c.post_id
    WHERE c.id = reactions.target_id AND (
      p.is_public = true OR p.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.friendships f
        WHERE (((f.requester_id = auth.uid() AND f.addressee_id = p.user_id)
             OR (f.addressee_id = auth.uid() AND f.requester_id = p.user_id)))
          AND f.status = 'accepted')
    )
  ))
);

-- 5. typing status spoofing
DROP POLICY IF EXISTS "Typing insert" ON public.typing_status;
DROP POLICY IF EXISTS "Typing update" ON public.typing_status;

-- 6. call signals scoped to call participants
DROP POLICY IF EXISTS "Users can insert their own signals" ON public.call_signals;
CREATE POLICY "Users can insert their own signals" ON public.call_signals FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id::text = call_signals.call_id
      AND (c.created_by = auth.uid() OR public.is_chat_participant(c.id, auth.uid()))
  )
);

-- 7. chat participant self-assigned admin
DROP POLICY IF EXISTS "users can add themselves to chat" ON public.chat_participants;
CREATE POLICY "users can add themselves to chat" ON public.chat_participants FOR INSERT WITH CHECK (
  user_id = auth.uid() AND coalesce(role, 'member') = 'member'
);
DROP POLICY IF EXISTS "Users can add participants to chats" ON public.chat_participants;
CREATE POLICY "Users can add participants to chats" ON public.chat_participants FOR INSERT WITH CHECK (
  (
    (user_id = auth.uid() AND coalesce(role, 'member') = 'member')
    OR EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_participants.chat_id AND c.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.chat_id = chat_participants.chat_id AND cp.user_id = auth.uid() AND cp.role = 'admin')
  )
);
DROP POLICY IF EXISTS "Users can update their own participation" ON public.chat_participants;
CREATE POLICY "Users can update their own participation" ON public.chat_participants FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND coalesce(role, 'member') = 'member');

-- 8. group members self-assigned admin
DROP POLICY IF EXISTS "Users can join public groups" ON public.group_members;
CREATE POLICY "Users can join public groups" ON public.group_members FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND coalesce(role, 'member') = 'member'
  AND EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.privacy = 'public')
);

-- 9. mutable search_path
ALTER FUNCTION public.chat_messages_latest(uuid) SET search_path = public;
ALTER FUNCTION public.chat_messages_older_than(uuid, timestamp with time zone, uuid) SET search_path = public;