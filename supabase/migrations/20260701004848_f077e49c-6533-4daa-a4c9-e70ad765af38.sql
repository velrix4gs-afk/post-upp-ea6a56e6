
-- 1. Realtime: drop open policies on realtime.messages (fixes realtime_messages_open_broadcast + messages_public_select_policy)
DROP POLICY IF EXISTS "authenticated can receive" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can send" ON realtime.messages;

-- 2. Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.moderation_filters;
ALTER PUBLICATION supabase_realtime DROP TABLE public.purchase_history;

-- 3. Remove user-facing SELECT policy on verification_codes (admins/service_role only)
DROP POLICY IF EXISTS "Users can view their own verification codes" ON public.verification_codes;

-- 4. Storage: allow chat participants to view message files uploaded by any participant
--    Drop shadowing sender-only public-role policies and add a participant-scoped policy.
DROP POLICY IF EXISTS "Users can view messages media in their chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own message media" ON storage.objects;

CREATE POLICY "Chat participants can view any message file"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'messages'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1
      FROM public.message_attachments ma
      JOIN public.messages m ON m.id = ma.message_id
      JOIN public.chat_participants cp ON cp.chat_id = m.chat_id
      WHERE ma.storage_path = objects.name
        AND cp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.messages m
      JOIN public.chat_participants cp ON cp.chat_id = m.chat_id
      WHERE cp.user_id = auth.uid()
        AND m.media_url IS NOT NULL
        AND m.media_url LIKE '%' || objects.name
    )
  )
);
