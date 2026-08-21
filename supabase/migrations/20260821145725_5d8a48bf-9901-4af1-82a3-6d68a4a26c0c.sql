
-- Update notify_task_assigned (should be safe to replace since return type is still trigger)
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    assigner_name TEXT;
    board_title TEXT;
BEGIN
    -- Suppression check
    IF current_setting('app.suppress_task_notifications', true) = 'on' THEN
        RETURN NEW;
    END IF;

    -- Only notify if assignee changed and is not null
    IF (TG_OP = 'UPDATE' AND (OLD.assignee IS DISTINCT FROM NEW.assignee) AND NEW.assignee IS NOT NULL) OR
       (TG_OP = 'INSERT' AND NEW.assignee IS NOT NULL) THEN
        
        -- Don't notify if assigning to self
        IF NEW.assignee = auth.uid() THEN
            RETURN NEW;
        END IF;

        -- Verify assignee exists in auth.users
        IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.assignee) THEN
            SELECT full_name INTO assigner_name FROM public.profiles WHERE user_id = auth.uid();
            SELECT title INTO board_title FROM public.boards WHERE id = NEW.board_id;

            INSERT INTO public.notifications (user_id, title, message, link)
            VALUES (
                NEW.assignee,
                '👤 Tarefa atribuída a você',
                COALESCE(assigner_name, 'Alguém') || ' atribuiu "' || NEW.title || '" a você no quadro ' || COALESCE(board_title, 'do projeto') || '.',
                '/board/' || NEW.board_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- Drop and recreate claim_placeholder to resolve signature/return type mismatch
DROP FUNCTION IF EXISTS public.claim_placeholder(uuid, uuid);
CREATE OR REPLACE FUNCTION public.claim_placeholder(_placeholder_id uuid, _real_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    placeholder_name TEXT;
    tasks_count INTEGER;
BEGIN
    -- Security check
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    SELECT full_name INTO placeholder_name FROM public.placeholder_members WHERE id = _placeholder_id;
    
    -- Start suppression
    PERFORM set_config('app.suppress_task_notifications', 'on', true);

    -- Migrate tasks
    UPDATE public.tasks 
    SET assignee = _real_user_id 
    WHERE assignee = _placeholder_id::text;
    
    GET DIAGNOSTICS tasks_count = ROW_COUNT;

    -- Migrate automation rules (action_value is text)
    UPDATE public.automation_rules
    SET action_value = _real_user_id::text
    WHERE action_value = _placeholder_id::text
      AND action_type IN ('move_group', 'change_priority', 'change_status'); -- Adjusted to project types

    -- Mark placeholder as claimed
    UPDATE public.placeholder_members
    SET claimed_by = _real_user_id
    WHERE id = _placeholder_id;

    -- End suppression
    PERFORM set_config('app.suppress_task_notifications', 'off', true);

    -- Single summary notification
    IF tasks_count > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (
            _real_user_id,
            '✅ Membro Provisório Vinculado',
            'O histórico do membro "' || placeholder_name || '" (' || tasks_count || ' tarefas) foi vinculado à sua conta.',
            '/'
        );
    END IF;
END;
$function$;
