-- 1) Atomic find-or-create for 1:1 chats
CREATE OR REPLACE FUNCTION public.ensure_private_chat(p_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_chat_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user IS NULL OR p_other_user = v_me THEN
    RAISE EXCEPTION 'Invalid conversation partner';
  END IF;

  SELECT cp1.chat_id INTO v_chat_id
  FROM chat_participants cp1
  JOIN chat_participants cp2 ON cp2.chat_id = cp1.chat_id
  JOIN chats c ON c.id = cp1.chat_id
  WHERE cp1.user_id = v_me
    AND cp2.user_id = p_other_user
    AND c.type = 'private'
  LIMIT 1;

  IF v_chat_id IS NOT NULL THEN
    RETURN v_chat_id;
  END IF;

  INSERT INTO chats (type, created_by, creator_id, created_at, updated_at)
  VALUES ('private', v_me, v_me, now(), now())
  RETURNING id INTO v_chat_id;

  INSERT INTO chat_participants (chat_id, user_id, role)
  VALUES (v_chat_id, v_me, 'admin'), (v_chat_id, p_other_user, 'member');

  RETURN v_chat_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_private_chat(uuid) TO authenticated;

-- 2) Clean up orphan private chats left behind by failed creations
DELETE FROM public.chats c
WHERE c.type = 'private'
  AND (SELECT count(*) FROM public.chat_participants cp WHERE cp.chat_id = c.id) < 2
  AND NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.chat_id = c.id);

-- 3) Security: remove OTP table from realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'email_otps'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.email_otps';
  END IF;
END $$;