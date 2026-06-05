
-- Drop overly broad storage SELECT policy on messages bucket; the
-- narrower "Chat participants can view message files" policy (which scopes
-- by chat_id from the file path) remains in place.
DROP POLICY IF EXISTS "Users can view message files from their chats" ON storage.objects;

-- Pin search_path on broadcast trigger functions.
CREATE OR REPLACE FUNCTION public.chat_messages_broadcast_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  PERFORM realtime.broadcast_changes(
    'chat:' || COALESCE(NEW.chat_id::text, OLD.chat_id::text),
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.messages_broadcast_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  PERFORM realtime.broadcast_changes(
    'room:' || COALESCE(NEW.room_id, OLD.room_id)::text || ':messages',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.notifications_broadcast_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  PERFORM realtime.broadcast_changes(
    'user:' || NEW.user_id::text || ':notifications',
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, NULL
  );
  RETURN NEW;
END;
$function$;
