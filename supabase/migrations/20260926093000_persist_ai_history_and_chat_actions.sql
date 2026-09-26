CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (length(content) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user_created
  ON public.ai_chat_messages (user_id, created_at);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.ai_chat_messages TO authenticated;

DROP POLICY IF EXISTS "Users manage their own AI chat history" ON public.ai_chat_messages;
CREATE POLICY "Users manage their own AI chat history"
  ON public.ai_chat_messages FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'chat_settings'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_settings;
  END IF;
END
$$;

ALTER TABLE public.chat_settings
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "Participants can view unexpired messages" ON public.messages;
CREATE POLICY "Participants can view visible unexpired messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    (expires_at IS NULL OR expires_at > now())
    AND NOT (auth.uid() = ANY (coalesce(deleted_for, ARRAY[]::uuid[])))
    AND EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.chat_id = messages.chat_id
        AND cp.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.clear_chat_for_user(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_chat_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE chat_id = p_chat_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant in this chat';
  END IF;

  UPDATE public.messages
  SET deleted_for = array_append(coalesce(deleted_for, ARRAY[]::uuid[]), auth.uid())
  WHERE chat_id = p_chat_id
    AND NOT (auth.uid() = ANY (coalesce(deleted_for, ARRAY[]::uuid[])));
END;
$$;

REVOKE ALL ON FUNCTION public.clear_chat_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_chat_for_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_chat_list()
RETURNS TABLE(
  chat_id uuid,
  type text,
  chat_name text,
  chat_created_at timestamptz,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text,
  last_message_id uuid,
  last_message text,
  last_message_at timestamptz,
  last_message_status text,
  unread_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_chats AS (
    SELECT c.*
    FROM public.chats c
    JOIN public.chat_participants cp ON cp.chat_id = c.id
    WHERE cp.user_id = auth.uid()
  ),
  participant_others AS (
    SELECT
      mc.id AS chat_id,
      mc.type,
      mc.name AS chat_name,
      mc.created_at AS chat_created_at,
      (
        SELECT p2.user_id
        FROM public.chat_participants p2
        WHERE p2.chat_id = mc.id
          AND p2.user_id <> auth.uid()
        LIMIT 1
      ) AS other_user_id
    FROM my_chats mc
  ),
  last_msgs AS (
    SELECT DISTINCT ON (m.chat_id)
      m.chat_id,
      m.id AS last_message_id,
      m.content AS last_message,
      m.created_at AS last_message_at,
      m.status AS last_message_status
    FROM public.messages m
    WHERE m.deleted_at IS NULL
      AND NOT (auth.uid() = ANY (coalesce(m.deleted_for, ARRAY[]::uuid[])))
      AND (m.expires_at IS NULL OR m.expires_at > now())
    ORDER BY m.chat_id, m.created_at DESC, m.id DESC
  ),
  unread_counts AS (
    SELECT msg.chat_id, count(*)::integer AS unread_count
    FROM public.messages msg
    WHERE msg.deleted_at IS NULL
      AND NOT (auth.uid() = ANY (coalesce(msg.deleted_for, ARRAY[]::uuid[])))
      AND (msg.expires_at IS NULL OR msg.expires_at > now())
      AND msg.status = 'sent'
      AND msg.sender_id <> auth.uid()
      AND msg.chat_id IS NOT NULL
    GROUP BY msg.chat_id
  ),
  user_profiles AS (
    SELECT id, username, avatar_url
    FROM public.profiles
  )
  SELECT
    po.chat_id,
    po.type,
    po.chat_name,
    po.chat_created_at,
    po.other_user_id,
    up.username AS other_user_name,
    up.avatar_url AS other_user_avatar,
    lm.last_message_id,
    lm.last_message,
    lm.last_message_at,
    lm.last_message_status,
    coalesce(uc.unread_count, 0) AS unread_count
  FROM participant_others po
  LEFT JOIN last_msgs lm ON lm.chat_id = po.chat_id
  LEFT JOIN unread_counts uc ON uc.chat_id = po.chat_id
  LEFT JOIN user_profiles up ON up.id = po.other_user_id
  ORDER BY coalesce(lm.last_message_at, po.chat_created_at) DESC;
$$;
