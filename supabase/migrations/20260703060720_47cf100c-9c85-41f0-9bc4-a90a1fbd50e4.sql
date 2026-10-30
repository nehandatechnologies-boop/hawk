
-- Tighten SELECT policies on sensitive tables to specific roles

-- CAMERAS: only staff roles can read (contains RTSP URLs)
DROP POLICY IF EXISTS "read cameras (signed in)" ON public.cameras;
CREATE POLICY "read cameras (staff)" ON public.cameras FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'Administrator'::app_role)
  OR has_role(auth.uid(), 'Supervisor'::app_role)
  OR has_role(auth.uid(), 'Security Officer'::app_role)
  OR has_role(auth.uid(), 'Operator'::app_role)
);

-- FACE ENROLLMENTS: only Admin/Supervisor can read biometric descriptors
DROP POLICY IF EXISTS "Authenticated can view enrollments" ON public.face_enrollments;
CREATE POLICY "Admins and Supervisors can view enrollments" ON public.face_enrollments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'Administrator'::app_role)
  OR has_role(auth.uid(), 'Supervisor'::app_role)
);

-- SUBJECTS: restrict PII to staff roles with legitimate need
DROP POLICY IF EXISTS "read subjects (signed in)" ON public.subjects;
CREATE POLICY "read subjects (staff)" ON public.subjects FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'Administrator'::app_role)
  OR has_role(auth.uid(), 'Supervisor'::app_role)
  OR has_role(auth.uid(), 'Security Officer'::app_role)
);

-- AUDIT LOGS: only service_role may INSERT (client cannot forge entries)
DROP POLICY IF EXISTS "write audit (signed in)" ON public.audit_logs;
-- No INSERT policy for authenticated means clients cannot insert.
-- service_role bypasses RLS.

-- Remove hardcoded admin email from handle_new_user trigger.
-- Admin promotion is now performed manually (out-of-band) via a service-role script.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'Viewer');
  RETURN NEW;
END;
$function$;

-- Revoke EXECUTE on client-facing SECURITY DEFINER function from authenticated.
-- The client will read its role directly from public.user_roles (already policy-scoped).
REVOKE EXECUTE ON FUNCTION public.get_user_primary_role(uuid) FROM PUBLIC, anon, authenticated;

-- Revoke EXECUTE on lookup_email_by_operator_id from all roles except service_role.
REVOKE EXECUTE ON FUNCTION public.lookup_email_by_operator_id(text) FROM PUBLIC, anon, authenticated;
