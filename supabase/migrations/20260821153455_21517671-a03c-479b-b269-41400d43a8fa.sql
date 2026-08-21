-- 1. Restaurar a função claim_placeholder com retorno JSONB e tratamento refinado de subtarefas
DROP FUNCTION IF EXISTS public.claim_placeholder(uuid, uuid);

CREATE OR REPLACE FUNCTION public.claim_placeholder(
  p_placeholder_id UUID,
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tasks_count INTEGER := 0;
  v_subtasks_count INTEGER := 0;
  v_placeholder RECORD;
  v_target_user_exists BOOLEAN;
  v_suppress_key TEXT := 'app.suppress_task_notifications';
BEGIN
  -- Validação de permissão (apenas admin/coordenador/owner)
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'coordinator') OR 
    public.has_role(auth.uid(), 'owner')
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Obter dados do provisório
  SELECT * INTO v_placeholder FROM public.placeholder_members WHERE id = p_placeholder_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provisório não encontrado';
  END IF;

  IF v_placeholder.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este provisório já foi convertido';
  END IF;

  -- Verificar se usuário alvo existe
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) INTO v_target_user_exists;
  IF NOT v_target_user_exists THEN
    RAISE EXCEPTION 'Usuário real não encontrado';
  END IF;

  -- Configurar supressão de notificações em massa
  PERFORM set_config(v_suppress_key, 'true', true);

  -- 1. Atribuir papel pretendido ao usuário real (se ele ainda não tiver)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_target_user_id AND role = v_placeholder.intended_role
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_target_user_id, v_placeholder.intended_role);
  END IF;

  -- 2. Migrar tarefas (assignee)
  UPDATE public.tasks
  SET assignee = p_target_user_id
  WHERE assignee = p_placeholder_id;
  GET DIAGNOSTICS v_tasks_count = ROW_COUNT;

  -- 3. Migrar subtarefas dentro do JSONB (assignee UUID)
  -- Buscamos tarefas que contenham o UUID do provisório no array de subtarefas
  WITH updated_subtasks AS (
    UPDATE public.tasks
    SET subtasks = (
      SELECT jsonb_agg(
        CASE 
          WHEN (elem->>'assignee')::uuid = p_placeholder_id 
          THEN elem || jsonb_build_object('assignee', p_target_user_id::text)
          ELSE elem 
        END
      )
      FROM jsonb_array_elements(subtasks) AS elem
    )
    WHERE subtasks @> jsonb_build_array(jsonb_build_object('assignee', p_placeholder_id::text))
    RETURNING 1
  )
  SELECT count(*) INTO v_subtasks_count FROM updated_subtasks;

  -- 4. Migrar regras de automação
  UPDATE public.automation_rules
  SET config = config || jsonb_build_object('assignee_id', p_target_user_id::text)
  WHERE config->>'assignee_id' = p_placeholder_id::text;

  -- 5. Marcar como convertido
  UPDATE public.placeholder_members
  SET 
    claimed_at = now(),
    claimed_by = auth.uid()
  WHERE id = p_placeholder_id;

  -- Restaurar configuração de notificações
  PERFORM set_config(v_suppress_key, 'false', true);

  -- 6. Notificação única de boas-vindas/resumo (opcional, mas recomendado)
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    p_target_user_id,
    'Histórico Importado',
    format('Você herdou %s tarefas e %s subtarefas de %s.', v_tasks_count, v_subtasks_count, v_placeholder.full_name),
    'info'
  );

  RETURN jsonb_build_object(
    'tasks_migrated', v_tasks_count,
    'subtasks_migrated', v_subtasks_count,
    'placeholder_name', v_placeholder.full_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_placeholder(uuid, uuid) TO authenticated;
GRANT ALL ON TABLE public.user_roles TO authenticated; -- Garantir que admin possa gerenciar roles se RLS permitir
GRANT ALL ON TABLE public.placeholder_members TO authenticated;
