
ALTER VIEW public.profiles_view SET (security_invoker = on);

REVOKE SELECT (gender) ON public.profiles FROM anon;
REVOKE SELECT (gender) ON public.profiles FROM authenticated;

DROP FUNCTION IF EXISTS public.get_my_sensitive_profile();
CREATE FUNCTION public.get_my_sensitive_profile()
 RETURNS TABLE(phone text, birth_date date, gender text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.phone, p.birth_date, p.gender FROM public.profiles p WHERE p.id = auth.uid();
$function$;

REVOKE SELECT (contact_email) ON public.pages FROM anon;

DROP POLICY IF EXISTS "Users can view all presence" ON public.user_presence;
DROP POLICY IF EXISTS "Presence view" ON public.user_presence;

CREATE POLICY "Authenticated users can view presence"
ON public.user_presence
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.user_presence FROM anon;
