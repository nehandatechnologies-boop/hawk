
-- 1. ALERTS mirror table for realtime
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Open',
  source text,
  camera_id text,
  camera_name text,
  location text,
  subject_id text,
  subject_name text,
  subject_category text,
  match_confidence numeric,
  thumbnail text,
  raised_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view alerts" ON public.alerts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert alerts" ON public.alerts
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Operators+ can update alerts" ON public.alerts
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(), 'Administrator'::app_role) OR
    has_role(auth.uid(), 'Supervisor'::app_role) OR
    has_role(auth.uid(), 'Security Officer'::app_role) OR
    has_role(auth.uid(), 'Operator'::app_role)
  );

CREATE TRIGGER alerts_updated_at BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER TABLE public.alerts REPLICA IDENTITY FULL;

-- 2. PROFILES: add operator_id + status
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS operator_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz;

-- Allow admins to view/update all profiles (for the operator management page)
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'Administrator'::app_role));

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'Administrator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'Administrator'::app_role));

-- 3. Primary admin allowlist - auto-promote on first signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_role := 'Viewer';
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));

  IF lower(NEW.email) = 'brianlevymadhobhi@gmail.com' THEN
    v_role := 'Administrator';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 4. Lookup function: operator_id -> email (for login)
CREATE OR REPLACE FUNCTION public.lookup_email_by_operator_id(_operator_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE operator_id = _operator_id AND status = 'Active' LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_email_by_operator_id(text) TO anon, authenticated;
