
-- Restrict alert creation to operator-tier roles (block Viewers/Auditors)
DROP POLICY IF EXISTS "Authenticated can insert alerts" ON public.alerts;
CREATE POLICY "Operators+ can insert alerts" ON public.alerts
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'Administrator'::app_role)
  OR public.has_role(auth.uid(), 'Supervisor'::app_role)
  OR public.has_role(auth.uid(), 'Security Officer'::app_role)
  OR public.has_role(auth.uid(), 'Operator'::app_role)
);

-- Explicit deny-by-default for escalations writes from client roles
-- (Escalations are written exclusively by server-side code using service role.)
CREATE POLICY "No client inserts on escalations" ON public.escalations
FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates on escalations" ON public.escalations
FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on escalations" ON public.escalations
FOR DELETE TO authenticated USING (false);

-- Revoke EXECUTE from client roles on SECURITY DEFINER helper functions
-- that should not be callable by signed-in users. has_role stays executable
-- because RLS policies invoke it as the calling role.
REVOKE EXECUTE ON FUNCTION public.lookup_email_by_operator_id(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_primary_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
