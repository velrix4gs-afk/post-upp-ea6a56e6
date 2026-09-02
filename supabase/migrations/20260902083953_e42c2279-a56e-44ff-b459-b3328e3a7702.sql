REVOKE SELECT (phone, birth_date, gender) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, birth_date, gender) ON public.profiles FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_sensitive_profile() TO authenticated;