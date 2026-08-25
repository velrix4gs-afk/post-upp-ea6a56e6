-- Drop existing RLS policies on chats and chat_participants
DROP POLICY IF EXISTS "users_view_own_chats" ON public.chats;
DROP POLICY IF EXISTS "users_create_chats" ON public.chats;
DROP POLICY IF EXISTS "users_update_own_chats" ON public.chats;
DROP POLICY IF EXISTS "users_view_own_participants" ON public.chat_participants;
DROP POLICY IF EXISTS "users_create_participants" ON public.chat_participants;

-- Enable RLS on chats
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Enable RLS on chat_participants
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for chats
CREATE POLICY "users_can_view_their_chats"
  ON public.chats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.chat_id = chats.id
      AND chat_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_create_chats"
  ON public.chats
  FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "users_can_update_their_chats"
  ON public.chats
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_participants.chat_id = chats.id
      AND chat_participants.user_id = auth.uid()
    )
  );

-- Create comprehensive RLS policies for chat_participants
CREATE POLICY "users_can_view_chat_participants"
  ON public.chat_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.chat_id = chat_participants.chat_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "users_can_add_participants"
  ON public.chat_participants
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);