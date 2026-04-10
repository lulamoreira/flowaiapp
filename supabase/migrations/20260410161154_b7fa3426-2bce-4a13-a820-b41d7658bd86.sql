
-- Update activity_log SELECT policy to allow coordinators too
DROP POLICY IF EXISTS "Admins can view all activity" ON public.activity_log;
CREATE POLICY "Admins and coordinators can view all activity"
  ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (is_admin_or_coordinator(auth.uid()));
