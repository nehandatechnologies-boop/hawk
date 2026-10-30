
-- Restrict SECURITY DEFINER function execution and tighten always-true RLS policies

-- 1) Revoke execute on lookup_email_by_operator_id from anon/authenticated/PUBLIC.
--    Lookup will move to a server-only path using the service role.
REVOKE ALL ON FUNCTION public.lookup_email_by_operator_id(text) FROM PUBLIC, anon, authenticated;

-- 2) Replace always-true policies with explicit auth.uid() IS NOT NULL checks.
DROP POLICY IF EXISTS "Authenticated can view alerts" ON public.alerts;
CREATE POLICY "Authenticated can view alerts"
  ON public.alerts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can insert alerts" ON public.alerts;
CREATE POLICY "Authenticated can insert alerts"
  ON public.alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can view enrollments" ON public.face_enrollments;
CREATE POLICY "Authenticated can view enrollments"
  ON public.face_enrollments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
