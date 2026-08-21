-- 1. Reset state
UPDATE public.placeholder_members
SET claimed_by = NULL,
    claimed_at = NULL
WHERE id = '737b40f9-d969-4be2-91df-df48999a622f';

UPDATE public.tasks
SET assignee = '737b40f9-d969-4be2-91df-df48999a622f'
WHERE title = 'Tarefa Teste Nathalia';

UPDATE public.tasks
SET subtasks = '[{"id": "sub-Nathalia", "title": "Subtarefa de Teste Nathalia", "completed": false, "assignee": "737b40f9-d969-4be2-91df-df48999a622f"}]'::jsonb
WHERE id = '89c43a74-f6fa-4f71-b68c-1492803e39d7';

-- 2. Execute logic directly (bypassing auth check for verification)
DO $$
DECLARE
    _placeholder_id UUID := '737b40f9-d969-4be2-91df-df48999a622f';
    _real_user_id UUID := 'a69024e4-a127-4b2a-ae33-3b609f162c25';
    placeholder_name TEXT;
    tasks_count INTEGER;
    t_row RECORD;
    new_subtasks JSONB;
BEGIN
    SELECT full_name INTO placeholder_name FROM public.placeholder_members WHERE id = _placeholder_id;
    
    PERFORM set_config('app.suppress_task_notifications', 'on', true);

    UPDATE public.tasks 
    SET assignee = _real_user_id 
    WHERE assignee = _placeholder_id;
    
    GET DIAGNOSTICS tasks_count = ROW_COUNT;

    FOR t_row IN 
        SELECT id, subtasks FROM public.tasks 
        WHERE subtasks @> ('[{"assignee": "' || _placeholder_id::text || '"}]')::jsonb
    LOOP
        new_subtasks := replace(t_row.subtasks::text, _placeholder_id::text, _real_user_id::text)::jsonb;
        UPDATE public.tasks SET subtasks = new_subtasks WHERE id = t_row.id;
    END LOOP;

    UPDATE public.placeholder_members
    SET claimed_by = _real_user_id,
        claimed_at = now()
    WHERE id = _placeholder_id;

    PERFORM set_config('app.suppress_task_notifications', 'off', true);

    IF tasks_count > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (_real_user_id, '✅ Membro Provisório Vinculado', 'O histórico foi vinculado.', '/');
    END IF;
END $$;
