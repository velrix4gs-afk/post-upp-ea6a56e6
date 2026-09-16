-- Public identity card for any profile, including private accounts.
-- Never returns phone, birth_date, or gender. Full details (bio/location/website)
-- are only included for the owner, approved followers, or accepted friends.

CREATE OR REPLACE FUNCTION public.get_profile_card(p_id uuid)
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
  viewer uuid := auth.uid();
  full_access boolean;
  priv boolean;
BEGIN
  SELECT p.is_private INTO priv
  FROM public.profiles p
  WHERE p.id = p_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  full_access :=
    (viewer IS NOT NULL AND viewer = p_id)
    OR priv IS NOT TRUE
    OR EXISTS (
      SELECT 1 FROM public.followers f
      WHERE f.follower_id = viewer
        AND f.following_id = p_id
        AND f.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM public.friendships fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.requester_id = viewer AND fr.addressee_id = p_id)
          OR (fr.addressee_id = viewer AND fr.requester_id = p_id)
        )
    );

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.cover_url,
    CASE WHEN full_access THEN p.bio ELSE NULL END,
    CASE WHEN full_access THEN p.location ELSE NULL END,
    CASE WHEN full_access THEN p.website ELSE NULL END,
    CASE WHEN full_access THEN p.relationship_status ELSE NULL END,
    p.theme_color,
    p.is_private,
    p.is_verified,
    p.verification_type,
    p.verified_at,
    p.created_at,
    p.updated_at,
    full_access
  FROM public.profiles p
  WHERE p.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_card(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_card(uuid) TO authenticated, anon;

-- Keep owner-only PII off the table SELECT grant.
REVOKE SELECT (phone, birth_date, gender) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, birth_date, gender) ON public.profiles FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_sensitive_profile() TO authenticated;
