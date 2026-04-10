
-- Allow the invited user to mark their own invitation as accepted
CREATE POLICY "Invited user can accept their invitation"
ON public.invitations
FOR UPDATE
USING (
  email = (SELECT auth.jwt() ->> 'email')
  AND status = 'pending'
)
WITH CHECK (
  email = (SELECT auth.jwt() ->> 'email')
  AND status = 'accepted'
);
