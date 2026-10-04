ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public';

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_audience_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_audience_check CHECK (audience IN ('public', 'followers', 'only-me'));