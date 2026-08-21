DROP FUNCTION IF EXISTS public.claim_placeholder(uuid, uuid);

CREATE OR REPLACE FUNCTION public.claim_placeholder(_placeholder_id uuid, _real_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    _placeholder_record RECORD;
    _tasks_count INTEGER := 0;
    _subtasks_count INTEGER := 0;
    _task_row RECORD;
    _subtask JSONB;
    _migrated_subtasks JSONB;
BEGIN
    IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator') OR public.has_role(auth.uid(), 'owner')) THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    SELECT * INTO _placeholder_record FROM public.placeholder_members WHERE id = _placeholder_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Membro provisório não encontrado.'; END IF;
    IF _placeholder_record.claimed_by IS NOT NULL THEN RAISE EXCEPTION 'Já vinculado.'; END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _real_user_id) THEN RAISE EXCEPTION 'Usuário real não existe.'; END IF;

    IF _placeholder_record.intended_role IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (_real_user_id, _placeholder_record.intended_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    PERFORM set_config('app.suppress_task_notifications', 'on', true);

    UPDATE public.tasks SET assignee = _real_user_id WHERE assignee = _placeholder_id;
    GET DIAGNOSTICS _tasks_count = ROW_COUNT;

    FOR _task_row IN SELECT id, subtasks FROM public.tasks WHERE subtasks @> ('[{"assignee": "' || _placeholder_id::text || '"}]')::jsonb LOOP
        _migrated_subtasks := '[]'::jsonb;
        FOR _subtask IN SELECT jsonb_array_elements(_task_row.subtasks) LOOP
            IF (_subtask->>'assignee') = _placeholder_id::text THEN
                _subtask := _subtask || jsonb_build_object('assignee', _real_user_id::text);
                _subtasks_count := _subtasks_count + 1;
            END IF;
            _migrated_subtasks := _migrated_subtasks || _subtask;
        END LOOP;
        UPDATE public.tasks SET subtasks = _migrated_subtasks WHERE id = _task_row.id;
    END LOOP;

    UPDATE public.automation_rules SET action_value = _real_user_id::text WHERE action_value = _placeholder_id::text AND action_type IN ('move_group', 'change_priority', 'change_status');

    UPDATE public.placeholder_members SET claimed_by = _real_user_id, claimed_at = now() WHERE id = _placeholder_id;
    PERFORM set_config('app.suppress_task_notifications', 'off', true);

    IF _tasks_count > 0 OR _subtasks_count > 0 THEN
        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (_real_user_id, '✅ Membro Provisório Vinculado', 'O histórico de "' || _placeholder_record.full_name || '" foi vinculado.', '/');
    END IF;

    RETURN jsonb_build_object('tasks_migrated', _tasks_count, 'subtasks_migrated', _subtasks_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_placeholder(uuid, uuid) TO authenticated;