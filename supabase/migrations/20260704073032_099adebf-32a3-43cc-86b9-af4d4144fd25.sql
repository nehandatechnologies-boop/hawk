
DROP POLICY IF EXISTS "read cameras (staff)" ON public.cameras;
CREATE POLICY "All authenticated can view cameras" ON public.cameras
FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
