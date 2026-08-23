-- 1. Tornar create_backup idempotente (não criar se houver um igual nos últimos 60 segundos)
CREATE OR REPLACE FUNCTION public.create_backup(_source TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payload JSONB;
    v_counts JSONB;
    v_snapshot_id UUID;
    v_existing_id UUID;
BEGIN
    -- IDEMPOTÊNCIA: Se já foi criado um snapshot da mesma origem nos últimos 60 segundos, retorna o existente
    SELECT id INTO v_existing_id
    FROM backup_snapshots
    WHERE trigger_source = _source
      AND created_at > now() - interval '60 seconds'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        SELECT counts INTO v_counts FROM backup_snapshots WHERE id = v_existing_id;
        RETURN jsonb_build_object('id', v_existing_id, 'counts', v_counts, 'recovered', true);
    END IF;

    -- Montar payload
    v_payload := jsonb_build_object(
        'boards', COALESCE((SELECT jsonb_agg(t) FROM boards t), '[]'::jsonb),
        'task_groups', COALESCE((SELECT jsonb_agg(t) FROM task_groups t), '[]'::jsonb),
        'tasks', COALESCE((SELECT jsonb_agg(t) FROM tasks t), '[]'::jsonb),
        'task_comments', COALESCE((SELECT jsonb_agg(t) FROM task_comments t), '[]'::jsonb),
        'task_custom_values', COALESCE((SELECT jsonb_agg(t) FROM task_custom_values t), '[]'::jsonb),
        'custom_fields', COALESCE((SELECT jsonb_agg(t) FROM custom_fields t), '[]'::jsonb),
        'automation_rules', COALESCE((SELECT jsonb_agg(t) FROM automation_rules t), '[]'::jsonb),
        'project_members', COALESCE((SELECT jsonb_agg(t) FROM project_members t), '[]'::jsonb),
        'placeholder_members', COALESCE((SELECT jsonb_agg(t) FROM placeholder_members t), '[]'::jsonb),
        'time_entries', COALESCE((SELECT jsonb_agg(t) FROM time_entries t), '[]'::jsonb),
        'intake_forms', COALESCE((SELECT jsonb_agg(t) FROM intake_forms t), '[]'::jsonb),
        'profiles', COALESCE((SELECT jsonb_agg(t) FROM profiles t), '[]'::jsonb),
        'user_roles', COALESCE((SELECT jsonb_agg(t) FROM user_roles t), '[]'::jsonb),
        'custom_functions', COALESCE((SELECT jsonb_agg(t) FROM custom_functions t), '[]'::jsonb),
        'function_permissions', COALESCE((SELECT jsonb_agg(t) FROM function_permissions t), '[]'::jsonb),
        'user_custom_functions', COALESCE((SELECT jsonb_agg(t) FROM user_custom_functions t), '[]'::jsonb),
        'invitations', COALESCE((SELECT jsonb_agg(t) FROM invitations t), '[]'::jsonb)
    );

    -- Contagem de linhas
    v_counts := jsonb_build_object(
        'boards', jsonb_array_length(v_payload->'boards'),
        'task_groups', jsonb_array_length(v_payload->'task_groups'),
        'tasks', jsonb_array_length(v_payload->'tasks'),
        'task_comments', jsonb_array_length(v_payload->'task_comments'),
        'task_custom_values', jsonb_array_length(v_payload->'task_custom_values'),
        'custom_fields', jsonb_array_length(v_payload->'custom_fields'),
        'automation_rules', jsonb_array_length(v_payload->'automation_rules'),
        'project_members', jsonb_array_length(v_payload->'project_members'),
        'placeholder_members', jsonb_array_length(v_payload->'placeholder_members'),
        'time_entries', jsonb_array_length(v_payload->'time_entries'),
        'intake_forms', jsonb_array_length(v_payload->'intake_forms'),
        'profiles', jsonb_array_length(v_payload->'profiles'),
        'user_roles', jsonb_array_length(v_payload->'user_roles'),
        'custom_functions', jsonb_array_length(v_payload->'custom_functions'),
        'function_permissions', jsonb_array_length(v_payload->'function_permissions'),
        'user_custom_functions', jsonb_array_length(v_payload->'user_custom_functions'),
        'invitations', jsonb_array_length(v_payload->'invitations')
    );

    -- Gravar snapshot
    INSERT INTO backup_snapshots (trigger_source, payload, counts)
    VALUES (_source, v_payload, v_counts)
    RETURNING id INTO v_snapshot_id;

    -- Retenção: apagar > 7 dias mas manter 5 últimos
    DELETE FROM backup_snapshots
    WHERE created_at < now() - interval '7 days'
      AND id NOT IN (
          SELECT id FROM backup_snapshots
          ORDER BY created_at DESC
          LIMIT 5
      );

    RETURN jsonb_build_object('id', v_snapshot_id, 'counts', v_counts);
END;
$$;