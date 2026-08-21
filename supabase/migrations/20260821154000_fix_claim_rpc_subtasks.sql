CREATE OR REPLACE FUNCTION public.claim_placeholder(_placeholder_id uuid, _real_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    placeholder_name TEXT;
    tasks_count INTEGER;
    t_row RECORD;
    new_subtasks JSONB;
BEGIN
    -- Security check
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator') OR public.has_role(auth.uid(), 'owner')) THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    SELECT full_name INTO placeholder_name FROM public.placeholder_members WHERE id = _placeholder_id;
    
    -- Start suppression
    PERFORM set_config('app.suppress_task_notifications', 'on', true);

    -- 1. Migrate direct assignee
    UPDATE public.tasks 
    SET assignee = _real_user_id 
    WHERE assignee = _placeholder_id;
    
    GET DIAGNOSTICS tasks_count = ROW_COUNT;

    -- 2. Migrate subtasks (JSONB replacement)
    -- We look for any task that has subtasks where this placeholder is mentioned
    FOR t_row IN 
        SELECT id, subtasks FROM public.tasks 
        WHERE subtasks @> ('[{"assignee": "' || _placeholder_id::text || '"}]')::jsonb
    LOOP
        -- Replace all occurrences of the placeholder ID with the real user ID in the JSON string
        -- This is a simple but effective way for JSONB replacement if the UUID is unique enough
        new_subtasks := replace(t_row.subtasks::text, _placeholder_id::text, _real_user_id::text)::jsonb;
        
        UPDATE public.tasks 
        SET subtasks = new_subtasks 
        WHERE id = t_row.id;
    END LOOP;

    -- 3. Migrate automation rules
    UPDATE public.automation_rules
    SET action_value = _real_user_id::text
    WHERE action_value = _placeholder_id::text
      AND action_type IN ('move_group', 'change_priority', 'change_status');

    -- 4. Mark placeholder as claimed
    UPDATE public.placeholder_members
    SET claimed_by = _real_user_id,
        claimed_at = now()
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
