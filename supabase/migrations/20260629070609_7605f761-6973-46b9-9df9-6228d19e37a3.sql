-- Restrict EXECUTE on SECURITY DEFINER trigger functions so signed-in users cannot call them directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role and get_user_primary_role must remain callable by authenticated users:
-- has_role is invoked inside RLS policies (caller needs EXECUTE even though function is SECURITY DEFINER),
-- and get_user_primary_role is called via RPC from the client to resolve the signed-in user's role.
-- Tighten them to authenticated only (no anon, no public).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_primary_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_primary_role(uuid) TO authenticated;