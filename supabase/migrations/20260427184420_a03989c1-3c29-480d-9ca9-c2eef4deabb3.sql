ALTER TABLE public.invitations ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS invited_name text;

-- Allow accepting invitations that have no email pre-set (link-only invites)
DROP POLICY IF EXISTS "Invited user can accept their invitation" ON public.invitations;
CREATE POLICY "Invited user can accept their invitation"
ON public.invitations
FOR UPDATE
TO public
USING (
  status = 'pending'
  AND (
    email IS NULL
    OR email = (SELECT auth.jwt() ->> 'email')
  )
)
WITH CHECK (
  status = 'accepted'
  AND (
    email IS NULL
    OR email = (SELECT auth.jwt() ->> 'email')
  )
);