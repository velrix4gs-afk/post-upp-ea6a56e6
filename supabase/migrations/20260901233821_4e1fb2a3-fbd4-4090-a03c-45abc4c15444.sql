REVOKE ALL ON FUNCTION public.ensure_private_chat(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_private_chat(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_private_chat(uuid) TO authenticated;