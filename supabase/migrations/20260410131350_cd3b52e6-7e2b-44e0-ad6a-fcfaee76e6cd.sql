
DROP POLICY "System can create notifications" ON public.notifications;
CREATE POLICY "Admin/Coordinator can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_coordinator(auth.uid()) OR auth.uid() = user_id);

DROP POLICY "System can insert activity" ON public.activity_log;
CREATE POLICY "Authenticated can insert own activity"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
