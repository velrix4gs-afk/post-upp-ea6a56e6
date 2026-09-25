ALTER TABLE public.chat_settings
ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;
