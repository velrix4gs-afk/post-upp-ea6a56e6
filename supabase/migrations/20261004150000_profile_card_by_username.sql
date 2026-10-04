CREATE OR REPLACE FUNCTION public.get_profile_card_by_username(p_username text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  cover_url text,
  bio text,
  location text,
  website text,
  relationship_status text,
  theme_color text,
  is_private boolean,
  is_verified boolean,
  verification_type text,
  verified_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  can_view_full boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid;
BEGIN
  SELECT p.id INTO profile_id
  FROM public.profiles p
  WHERE lower(p.username) = lower(p_username)
  LIMIT 1;

  IF profile_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.get_profile_card(profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_card_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_card_by_username(text) TO authenticated, anon;
