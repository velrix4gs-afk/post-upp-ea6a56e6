-- Notification trigger for new chat messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sender_name text;
  preview text;
  rec record;
BEGIN
  -- Skip system / deleted messages
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  preview := COALESCE(NULLIF(NEW.content, ''), 'Sent an attachment');

  -- One notification per recipient (chat participants excluding sender)
  FOR rec IN
    SELECT cp.user_id
    FROM public.chat_participants cp
    WHERE cp.chat_id = NEW.chat_id
      AND cp.user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, content, data)
    VALUES (
      rec.user_id,
      'message',
      COALESCE(sender_name, 'New message'),
      preview,
      jsonb_build_object('chat_id', NEW.chat_id, 'sender_id', NEW.sender_id, 'message_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_new_message_trg ON public.messages;
CREATE TRIGGER notify_new_message_trg
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();
