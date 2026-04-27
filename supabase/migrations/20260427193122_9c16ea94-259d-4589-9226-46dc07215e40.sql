-- Trigger to notify the inviter when someone accepts an invitation
CREATE OR REPLACE FUNCTION public.notify_invitation_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    v_name := COALESCE(NEW.invited_name, NEW.email, 'Alguém');
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (
      NEW.invited_by,
      'Novo cadastro via convite',
      v_name || ' acabou de se cadastrar com seu convite.',
      '/admin'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_invitation_accepted ON public.invitations;
CREATE TRIGGER trg_notify_invitation_accepted
AFTER UPDATE ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.notify_invitation_accepted();