CREATE POLICY "Admin/Coordinator can delete pending invitations"
ON public.invitations
FOR DELETE
TO authenticated
USING (
  is_admin_or_coordinator(auth.uid())
  AND status = 'pending'
);