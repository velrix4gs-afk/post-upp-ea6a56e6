CREATE OR REPLACE FUNCTION public.mark_chat_messages_read(p_chat_id uuid)
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

  INSERT INTO public.message_reads (message_id, user_id, read_at)
  SELECT message.id, auth.uid(), now()
  FROM public.messages AS message
  WHERE message.chat_id = p_chat_id
    AND message.sender_id <> auth.uid()
    AND message.deleted_at IS NULL
    AND (message.expires_at IS NULL OR message.expires_at > now())
    AND NOT (auth.uid() = ANY (coalesce(message.deleted_for, ARRAY[]::uuid[])))
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_chat_messages_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_chat_messages_read(uuid) TO authenticated;

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
      CASE
        WHEN m.sender_id = auth.uid() AND EXISTS (
          SELECT 1
          FROM public.message_reads mr
          WHERE mr.message_id = m.id
            AND mr.user_id <> auth.uid()
        ) THEN 'read'
        ELSE m.status
      END AS last_message_status
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
      AND msg.sender_id <> auth.uid()
      AND msg.chat_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.message_reads mr
        WHERE mr.message_id = msg.id
          AND mr.user_id = auth.uid()
      )
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'message_reads'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
  END IF;
END
$$;
