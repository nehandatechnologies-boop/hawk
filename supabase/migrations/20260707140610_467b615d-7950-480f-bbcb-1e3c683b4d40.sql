
-- Restrict SELECT to staff roles only (block default 'Viewer' self-signups)

-- alerts
DROP POLICY IF EXISTS "Authenticated can view alerts" ON public.alerts;
CREATE POLICY "Staff can view alerts" ON public.alerts FOR SELECT
USING (
  has_role(auth.uid(), 'Administrator'::app_role)
  OR has_role(auth.uid(), 'Supervisor'::app_role)
  OR has_role(auth.uid(), 'Security Officer'::app_role)
  OR has_role(auth.uid(), 'Operator'::app_role)
  OR has_role(auth.uid(), 'Auditor'::app_role)
);

-- cameras
DROP POLICY IF EXISTS "All authenticated can view cameras" ON public.cameras;
CREATE POLICY "Staff can view cameras" ON public.cameras FOR SELECT
USING (
  has_role(auth.uid(), 'Administrator'::app_role)
  OR has_role(auth.uid(), 'Supervisor'::app_role)
  OR has_role(auth.uid(), 'Security Officer'::app_role)
  OR has_role(auth.uid(), 'Operator'::app_role)
  OR has_role(auth.uid(), 'Auditor'::app_role)
);

-- assets
DROP POLICY IF EXISTS "read assets (signed in)" ON public.assets;
CREATE POLICY "Staff can view assets" ON public.assets FOR SELECT
USING (
  has_role(auth.uid(), 'Administrator'::app_role)
  OR has_role(auth.uid(), 'Supervisor'::app_role)
  OR has_role(auth.uid(), 'Security Officer'::app_role)
  OR has_role(auth.uid(), 'Operator'::app_role)
  OR has_role(auth.uid(), 'Auditor'::app_role)
);

-- departments
DROP POLICY IF EXISTS "read departments (signed in)" ON public.departments;
CREATE POLICY "Staff can view departments" ON public.departments FOR SELECT
USING (
  has_role(auth.uid(), 'Administrator'::app_role)
  OR has_role(auth.uid(), 'Supervisor'::app_role)
  OR has_role(auth.uid(), 'Security Officer'::app_role)
  OR has_role(auth.uid(), 'Operator'::app_role)
  OR has_role(auth.uid(), 'Auditor'::app_role)
);

-- Revoke EXECUTE on SECURITY DEFINER functions not meant to be called by signed-in users.
-- has_role is intentionally left executable because RLS policies call it.
REVOKE EXECUTE ON FUNCTION public.get_user_primary_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lookup_email_by_operator_id(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
