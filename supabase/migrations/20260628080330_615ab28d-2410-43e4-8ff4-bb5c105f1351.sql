CREATE TABLE public.face_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id TEXT NOT NULL UNIQUE,
  personnel_name TEXT NOT NULL,
  descriptor JSONB NOT NULL,
  thumbnail TEXT,
  enrolled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.face_enrollments TO authenticated;
GRANT ALL ON public.face_enrollments TO service_role;

ALTER TABLE public.face_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view enrollments" ON public.face_enrollments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and Supervisors can insert enrollments" ON public.face_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Administrator') OR public.has_role(auth.uid(), 'Supervisor'));

CREATE POLICY "Admins and Supervisors can update enrollments" ON public.face_enrollments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'Administrator') OR public.has_role(auth.uid(), 'Supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrator') OR public.has_role(auth.uid(), 'Supervisor'));

CREATE POLICY "Admins and Supervisors can delete enrollments" ON public.face_enrollments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Administrator') OR public.has_role(auth.uid(), 'Supervisor'));

CREATE TRIGGER update_face_enrollments_updated_at
  BEFORE UPDATE ON public.face_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();