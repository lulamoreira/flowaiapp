
DO $$
DECLARE
    v_placeholder_id UUID := '737b40f9-d969-4be2-91df-df48999a622f';
    v_real_user_id UUID := 'a69024e4-a127-4b2a-ae33-3b609f162c25';
    v_tasks_count INTEGER;
BEGIN
    -- We can call the actual function if we wrap it in a session that has an admin UID
    -- But it's easier to just run the logic for verification.
    
    PERFORM set_config('app.suppress_task_notifications', 'on', true);

    UPDATE public.tasks 
    SET assignee = v_real_user_id 
    WHERE assignee = v_placeholder_id;
    
    GET DIAGNOSTICS v_tasks_count = ROW_COUNT;

    UPDATE public.placeholder_members
    SET claimed_by = v_real_user_id
    WHERE id = v_placeholder_id;

    PERFORM set_config('app.suppress_task_notifications', 'off', true);
END $$;
