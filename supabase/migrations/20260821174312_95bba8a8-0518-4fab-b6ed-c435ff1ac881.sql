CREATE OR REPLACE FUNCTION public.claim_placeholder(p_placeholder_id uuid, p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_placeholder_record RECORD;
    v_tasks_count INTEGER := 0;
    v_subtasks_count INTEGER := 0;
    v_memberships_count INTEGER := 0;
    v_task_row RECORD;
    v_subtask JSONB;
    v_migrated_subtasks JSONB;
BEGIN
    -- Permission check
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator') OR public.has_role(auth.uid(), 'owner')) THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    -- Existence and state checks
    SELECT * INTO v_placeholder_record FROM public.placeholder_members WHERE id = p_placeholder_id;
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Membro provisório não encontrado.'; 
    END IF;
    
    IF v_placeholder_record.claimed_at IS NOT NULL THEN 
        RAISE EXCEPTION 'Este membro já foi convertido.'; 
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN 
        RAISE EXCEPTION 'Usuário real não existe.'; 
    END IF;

    -- 1. Grant intended role to real user
    IF v_placeholder_record.intended_role IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (p_target_user_id, v_placeholder_record.intended_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    -- 2. Suppress notifications during migration
    PERFORM set_config('app.suppress_task_notifications', 'on', true);

    -- 3. Migrate project memberships
    -- Delete existing memberships for real user if they conflict with placeholder memberships
    DELETE FROM public.project_members pm_target
    USING public.project_members pm_placeholder
    WHERE pm_placeholder.user_id = p_placeholder_id
      AND pm_target.user_id = p_target_user_id
      AND pm_target.board_id = pm_placeholder.board_id;

    -- Migrate placeholder memberships to real user
    UPDATE public.project_members
    SET user_id = p_target_user_id
    WHERE user_id = p_placeholder_id;
    GET DIAGNOSTICS v_memberships_count = ROW_COUNT;

    -- 4. Migrate primary tasks
    UPDATE public.tasks 
    SET assignee = p_target_user_id 
    WHERE assignee = p_placeholder_id;
    GET DIAGNOSTICS v_tasks_count = ROW_COUNT;

    -- 5. Migrate subtasks element by element
    FOR v_task_row IN 
        SELECT id, subtasks FROM public.tasks 
        WHERE subtasks @> jsonb_build_array(jsonb_build_object('assignee', p_placeholder_id::text))
    LOOP
        v_migrated_subtasks := '[]'::jsonb;
        FOR v_subtask IN SELECT jsonb_array_elements(v_task_row.subtasks) LOOP
            IF (v_subtask->>'assignee') = p_placeholder_id::text THEN
                v_subtask := v_subtask || jsonb_build_object('assignee', p_target_user_id::text);
                v_subtasks_count := v_subtasks_count + 1;
            END IF;
            v_migrated_subtasks := v_migrated_subtasks || v_subtask;
        END LOOP;
        
        UPDATE public.tasks 
        SET subtasks = v_migrated_subtasks 
        WHERE id = v_task_row.id;
    END LOOP;

    -- 6. Migrate automation rules
    UPDATE public.automation_rules 
    SET action_value = p_target_user_id::text 
    WHERE action_value = p_placeholder_id::text 
      AND action_type IN ('move_group', 'change_priority', 'change_status');

    -- 7. Mark placeholder as claimed by the REAL USER
    UPDATE public.placeholder_members 
    SET claimed_by = p_target_user_id, 
        claimed_at = now() 
    WHERE id = p_placeholder_id;

    -- 8. Restore notification config
    PERFORM set_config('app.suppress_task_notifications', 'off', true);

    -- 9. Issue single summary notification
    IF v_tasks_count > 0 OR v_subtasks_count > 0 OR v_memberships_count > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (
            p_target_user_id, 
            '✅ Membro Provisório Vinculado', 
            'O histórico de "' || v_placeholder_record.full_name || '" foi vinculado à sua conta (' || v_tasks_count || ' tarefas, ' || v_subtasks_count || ' subtarefas, ' || v_memberships_count || ' projetos).', 
            '/'
        );
    END IF;

    RETURN jsonb_build_object(
        'tasks_migrated', v_tasks_count, 
        'subtasks_migrated', v_subtasks_count,
        'memberships_migrated', v_memberships_count
    );
END;
$function$;