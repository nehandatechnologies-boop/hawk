
-- ============ departments ============
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  head TEXT NOT NULL DEFAULT '',
  headcount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read departments (signed in)" ON public.departments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "write departments (staff)" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor'));
CREATE POLICY "update departments (staff)" ON public.departments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor')) WITH CHECK (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor'));
CREATE POLICY "delete departments (admin)" ON public.departments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'Administrator'));

-- ============ subjects (persons of interest) ============
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT NOT NULL UNIQUE,
  national_id TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  photo_url TEXT,
  category TEXT,
  danger_level TEXT,
  aliases TEXT,
  date_of_birth DATE,
  gender TEXT,
  last_seen_location TEXT,
  last_seen_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read subjects (signed in)" ON public.subjects FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert subjects (staff)" ON public.subjects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor') OR public.has_role(auth.uid(),'Security Officer'));
CREATE POLICY "update subjects (staff)" ON public.subjects FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor') OR public.has_role(auth.uid(),'Security Officer')) WITH CHECK (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor') OR public.has_role(auth.uid(),'Security Officer'));
CREATE POLICY "delete subjects (admin)" ON public.subjects FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'Administrator'));
CREATE INDEX subjects_category_idx ON public.subjects (category);
CREATE INDEX subjects_status_idx ON public.subjects (status);

-- ============ cameras ============
CREATE TABLE public.cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  building TEXT NOT NULL DEFAULT '',
  floor TEXT NOT NULL DEFAULT '',
  rtsp_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Online',
  resolution TEXT NOT NULL DEFAULT '1080p',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cameras TO authenticated;
GRANT ALL ON public.cameras TO service_role;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read cameras (signed in)" ON public.cameras FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert cameras (staff)" ON public.cameras FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor') OR public.has_role(auth.uid(),'Security Officer'));
CREATE POLICY "update cameras (staff)" ON public.cameras FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor') OR public.has_role(auth.uid(),'Security Officer')) WITH CHECK (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor') OR public.has_role(auth.uid(),'Security Officer'));
CREATE POLICY "delete cameras (admin)" ON public.cameras FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'Administrator'));

-- ============ assets ============
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  serial_number TEXT NOT NULL DEFAULT '',
  manufacturer TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  assigned_user TEXT,
  purchase_date DATE,
  warranty_until DATE,
  status TEXT NOT NULL DEFAULT 'In Use',
  image_url TEXT,
  barcode TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read assets (signed in)" ON public.assets FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "insert assets (staff)" ON public.assets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor') OR public.has_role(auth.uid(),'Security Officer'));
CREATE POLICY "update assets (staff)" ON public.assets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor') OR public.has_role(auth.uid(),'Security Officer')) WITH CHECK (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Supervisor') OR public.has_role(auth.uid(),'Security Officer'));
CREATE POLICY "delete assets (admin)" ON public.assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'Administrator'));

-- ============ audit_logs ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT NOT NULL DEFAULT '',
  actor_id UUID,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read audit (admin/aud/sup)" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'Administrator') OR public.has_role(auth.uid(),'Auditor') OR public.has_role(auth.uid(),'Supervisor'));
CREATE POLICY "write audit (signed in)" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);

-- ============ updated_at triggers ============
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subjects_updated    BEFORE UPDATE ON public.subjects    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cameras_updated     BEFORE UPDATE ON public.cameras     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_assets_updated      BEFORE UPDATE ON public.assets      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
