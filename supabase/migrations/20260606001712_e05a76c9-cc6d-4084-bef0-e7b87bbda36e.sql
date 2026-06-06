
-- 1) email_otps: remove client SELECT access (verification must be server-side)
DROP POLICY IF EXISTS "Users can only view their own OTPs" ON public.email_otps;

-- 2) verification_codes: remove self-redeem escalation
DROP POLICY IF EXISTS "Users can redeem verification codes" ON public.verification_codes;

-- 3) Remove sensitive tables from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.verification_codes;

-- 4) message_attachments: add participant-scoped SELECT so Realtime RLS limits broadcasts
DROP POLICY IF EXISTS "Chat participants can view message attachments" ON public.message_attachments;
CREATE POLICY "Chat participants can view message attachments"
ON public.message_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.chat_participants cp ON cp.chat_id = m.chat_id
    WHERE m.id = message_attachments.message_id
      AND cp.user_id = auth.uid()
  )
);
