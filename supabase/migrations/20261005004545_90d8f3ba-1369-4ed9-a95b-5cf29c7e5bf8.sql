ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS social_links jsonb;

DO $$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.purge_expired_messages(uuid)'::regprocedure) INTO src;
  IF src ILIKE '%last_message = latest.content%' THEN
    src := replace(src, 'last_message = latest.content', 'last_message_id = latest.id');
    EXECUTE src;
  END IF;
END $$;