
-- Fix invitations for users who already registered
UPDATE public.invitations
SET status = 'accepted', accepted_at = now()
WHERE status = 'pending'
AND email IN (
  SELECT email FROM auth.users
);
