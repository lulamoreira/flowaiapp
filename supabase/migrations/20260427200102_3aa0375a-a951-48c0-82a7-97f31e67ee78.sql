
-- Function to accept an invitation by token, bypassing RLS and auth session requirement.
-- Safe because it requires knowing the secret token, validates status & expiry,
-- and only flips status to 'accepted'.
CREATE OR REPLACE FUNCTION public.accept_invitation_by_token(_token uuid, _accepted_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.invitations WHERE token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'invitation_id', v_inv.id, 'invited_by', v_inv.invited_by);
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  UPDATE public.invitations
     SET status = 'accepted',
         accepted_at = now()
   WHERE id = v_inv.id;

  RETURN jsonb_build_object('ok', true, 'invitation_id', v_inv.id, 'invited_by', v_inv.invited_by, 'invited_name', v_inv.invited_name);
END;
$$;

-- Allow anonymous & authenticated calls (token acts as the secret).
GRANT EXECUTE ON FUNCTION public.accept_invitation_by_token(uuid, uuid) TO anon, authenticated;
