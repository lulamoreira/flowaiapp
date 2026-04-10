
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee IS NOT NULL AND (OLD.assignee IS NULL OR OLD.assignee <> NEW.assignee) THEN
    INSERT INTO public.notifications (user_id, title, message, link)
    VALUES (
      NEW.assignee,
      'Tarefa atribuída a você',
      'A tarefa "' || NEW.title || '" foi atribuída a você.',
      '/board/' || NEW.board_id
    );
  END IF;
  RETURN NEW;
END;
$$;
