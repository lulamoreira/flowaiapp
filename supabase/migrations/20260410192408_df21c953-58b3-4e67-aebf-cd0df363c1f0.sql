
-- Function to create notification when task is assigned
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify when assignee changes to a non-null value
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

-- Trigger on tasks table
CREATE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE OF assignee ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();

-- Enable pg_cron and pg_net for scheduled deadline checks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
