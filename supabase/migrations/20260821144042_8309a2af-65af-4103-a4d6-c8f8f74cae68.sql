-- 1. Restore SECURITY DEFINER to notify_task_assigned
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee IS NOT NULL AND (OLD.assignee IS NULL OR OLD.assignee <> NEW.assignee) THEN
    -- Apenas notificar se o usuário existir em auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.assignee) THEN
      INSERT INTO public.notifications (user_id, title, message, link)
      VALUES (
        NEW.assignee,
        'Tarefa atribuída a você',
        'A tarefa "' || NEW.title || '" foi atribuída a você.',
        '/board/' || NEW.board_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Update claim_placeholder to suppress triggers and remove dead code
CREATE OR REPLACE FUNCTION public.claim_placeholder(_placeholder_id uuid, _real_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count_tasks integer;
  v_count_subtasks integer := 0;
  v_placeholder public.placeholder_members;
  v_real_user_name text;
BEGIN
  -- a) Valide permissão
  IF NOT public.is_admin_or_coordinator(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores ou coordenadores podem realizar esta conversão.';
  END IF;

  -- b) Valide placeholder e real_user
  SELECT * INTO v_placeholder FROM public.placeholder_members WHERE id = _placeholder_id FOR UPDATE;
  IF v_placeholder.id IS NULL OR v_placeholder.claimed_by IS NOT NULL THEN
    RAISE EXCEPTION 'Membro provisório inválido ou já convertido.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _real_user_id) THEN
    RAISE EXCEPTION 'Usuário real não encontrado.';
  END IF;

  SELECT full_name INTO v_real_user_name FROM public.profiles WHERE user_id = _real_user_id;

  -- c) Suprimir gatilhos para evitar notificações em massa
  SET LOCAL session_replication_role = 'replica';

  -- d) Migrar tarefas
  UPDATE public.tasks SET assignee = _real_user_id WHERE assignee = _placeholder_id;
  GET DIAGNOSTICS v_count_tasks = ROW_COUNT;

  -- e) Migrar subtarefas JSONB
  UPDATE public.tasks 
  SET subtasks = (
    SELECT jsonb_agg(
      CASE 
        WHEN (item->>'assignee') = _placeholder_id::text THEN item - 'assignee' || jsonb_build_object('assignee', _real_user_id::text)
        ELSE item 
      END
    )
    FROM jsonb_array_elements(subtasks) AS item
  )
  WHERE subtasks @> jsonb_build_array(jsonb_build_object('assignee', _placeholder_id::text));
  
  -- g) Restaurar gatilhos
  SET LOCAL session_replication_role = 'origin';

  -- h) Conceder papel
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_real_user_id, v_placeholder.intended_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- i) Marcar convertido
  UPDATE public.placeholder_members 
  SET claimed_by = _real_user_id, claimed_at = now() 
  WHERE id = _placeholder_id;

  -- j) Notificação única
  INSERT INTO public.notifications (user_id, title, message, link)
  VALUES (_real_user_id, 'Conversão de membro', 'Você foi convertido de membro provisório para usuário real. ' || v_count_tasks || ' tarefas foram migradas.', '/');

  RETURN jsonb_build_object('tasks_migrated', v_count_tasks);
END;
$$;
