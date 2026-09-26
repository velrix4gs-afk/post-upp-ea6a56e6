CREATE OR REPLACE FUNCTION public.apply_chat_message_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expiry_seconds integer;
BEGIN
  IF NEW.expires_at IS NULL AND NEW.chat_id IS NOT NULL AND NEW.sender_id IS NOT NULL THEN
    SELECT auto_delete_duration
      INTO expiry_seconds
      FROM public.chat_settings
      WHERE chat_id = NEW.chat_id
        AND user_id = NEW.sender_id;

    IF expiry_seconds IS NOT NULL AND expiry_seconds > 0 THEN
      NEW.expires_at := coalesce(NEW.created_at, now()) + make_interval(secs => expiry_seconds);
      NEW.auto_delete_enabled := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_chat_message_expiry_before_insert ON public.messages;
CREATE TRIGGER apply_chat_message_expiry_before_insert
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_chat_message_expiry();

CREATE OR REPLACE FUNCTION public.purge_expired_messages(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_chat_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_chat_id IS NULL THEN
    RAISE EXCEPTION 'A chat id is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE chat_id = p_chat_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant in this chat';
  END IF;

  WITH deleted AS (
    DELETE FROM public.messages
    WHERE expires_at IS NOT NULL
      AND expires_at <= now()
      AND chat_id = p_chat_id
    RETURNING chat_id
  )
  SELECT array_agg(DISTINCT chat_id)
    INTO deleted_chat_ids
    FROM deleted;

  IF coalesce(array_length(deleted_chat_ids, 1), 0) > 0 THEN
    UPDATE public.chats c
    SET last_message = latest.content,
        last_message_at = latest.created_at
    FROM unnest(deleted_chat_ids) AS affected(chat_id)
    LEFT JOIN LATERAL (
      SELECT m.content, m.created_at
      FROM public.messages m
      WHERE m.chat_id = affected.chat_id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS latest ON true
    WHERE c.id = affected.chat_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_messages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_messages(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages from chats they're in" ON public.messages;
DROP POLICY IF EXISTS "Allow select for participants" ON public.messages;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.messages;
DROP POLICY IF EXISTS "message_sender_can_select" ON public.messages;
DROP POLICY IF EXISTS "messages_participants_can_select" ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "view_messages_in_own_chat" ON public.messages;
DROP POLICY IF EXISTS "authenticated can receive" ON public.messages;

CREATE POLICY "Participants can view unexpired messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.chat_id = messages.chat_id
        AND cp.user_id = auth.uid()
    )
  );
