-- Remove sensitive PII columns from the reachable column set for other users.
REVOKE SELECT (phone, birth_date, gender) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, birth_date, gender) ON public.profiles FROM anon;

-- Relationship status should not be readable by anonymous visitors.
REVOKE SELECT (relationship_status) ON public.profiles FROM anon;

-- The owner-only accessor keeps working for the profile owner.
GRANT EXECUTE ON FUNCTION public.get_my_sensitive_profile() TO authenticated;