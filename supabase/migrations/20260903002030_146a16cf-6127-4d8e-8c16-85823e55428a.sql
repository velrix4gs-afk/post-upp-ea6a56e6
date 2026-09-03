ALTER TABLE public.users ALTER COLUMN password_hash SET DEFAULT '';

INSERT INTO public.users (id, full_name, email, phone, password_hash, username, avatar_url, is_verified, created_at, updated_at)
SELECT
  au.id,
  COALESCE(p.display_name, p.full_name, au.email),
  au.email,
  au.phone,
  '',
  p.username,
  p.avatar_url,
  COALESCE(p.is_verified, false),
  COALESCE(au.created_at, now()),
  now()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_profile_to_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, username, avatar_url, is_verified, password_hash)
  VALUES (NEW.id, COALESCE(NEW.display_name, NEW.full_name), NEW.username, NEW.avatar_url, COALESCE(NEW.is_verified, false), '')
  ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        username = EXCLUDED.username,
        avatar_url = EXCLUDED.avatar_url,
        is_verified = EXCLUDED.is_verified,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_users ON public.profiles;
CREATE TRIGGER profiles_sync_users
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_users();

CREATE OR REPLACE FUNCTION public.sync_auth_user_to_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, phone, password_hash)
  VALUES (NEW.id, NEW.email, NEW.phone, '')
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auth_users_sync_public_users ON auth.users;
CREATE TRIGGER auth_users_sync_public_users
AFTER INSERT OR UPDATE OF email, phone ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_to_users();