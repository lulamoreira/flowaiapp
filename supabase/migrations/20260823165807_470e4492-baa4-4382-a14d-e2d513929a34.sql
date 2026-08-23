-- REFORÇO DE SEGURANÇA E CORREÇÃO DE RLS

-- 1. FUNÇÃO PARA VERIFICAR QUADRO PÚBLICO
CREATE OR REPLACE FUNCTION public.is_public_board(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards
    WHERE id = _board_id 
      AND public_timeline_enabled = true
  );
$$;

-- 2. CORREÇÃO DA FUNÇÃO can_access_board (REMOVER REGRA PÚBLICA)
CREATE OR REPLACE FUNCTION public.can_access_board(_board_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id 
          AND role IN ('admin', 'owner', 'coordinator')
    ) OR EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE board_id = _board_id 
          AND user_id = _user_id
    );
$$;

-- 3. REVISÃO DE POLÍTICAS: BOARDS (Separação estrita)
DROP POLICY IF EXISTS "Boards access control" ON public.boards;
DROP POLICY IF EXISTS "Anon can view public boards" ON public.boards;

-- SELECT: Autenticado com acesso OU Anon se público
CREATE POLICY "Boards SELECT access" ON public.boards
FOR SELECT TO authenticated
USING (public.can_access_board(id, auth.uid()));

CREATE POLICY "Boards SELECT public anon" ON public.boards
FOR SELECT TO anon
USING (public.is_public_board(id));

-- ESCRITA: Apenas admin/owner/coordinator ou criador (se permitido)
CREATE POLICY "Boards INSERT access" ON public.boards
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Boards UPDATE access" ON public.boards
FOR UPDATE TO authenticated
USING (public.is_admin_or_coordinator(auth.uid()))
WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Boards DELETE access" ON public.boards
FOR DELETE TO authenticated
USING (public.is_admin_or_coordinator(auth.uid()));

-- 4. REVISÃO DE POLÍTICAS: TASKS
DROP POLICY IF EXISTS "Tasks access control" ON public.tasks;
DROP POLICY IF EXISTS "Anon can view public tasks" ON public.tasks;

CREATE POLICY "Tasks SELECT access" ON public.tasks
FOR SELECT TO authenticated
USING (public.can_access_board(board_id, auth.uid()));

CREATE POLICY "Tasks SELECT public anon" ON public.tasks
FOR SELECT TO anon
USING (public.is_public_board(board_id));

CREATE POLICY "Tasks INSERT access" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (public.can_access_board(board_id, auth.uid()));

CREATE POLICY "Tasks UPDATE access" ON public.tasks
FOR UPDATE TO authenticated
USING (public.can_access_board(board_id, auth.uid()))
WITH CHECK (public.can_access_board(board_id, auth.uid()));

CREATE POLICY "Tasks DELETE access" ON public.tasks
FOR DELETE TO authenticated
USING (public.can_access_board(board_id, auth.uid()));

-- 5. ENDURECIMENTO DAS TABELAS QUE FALTAVAM

-- TASK_GROUPS
DROP POLICY IF EXISTS "Authenticated can view groups" ON public.task_groups;
DROP POLICY IF EXISTS "Authenticated can create groups" ON public.task_groups;
DROP POLICY IF EXISTS "Authenticated can update groups" ON public.task_groups;
DROP POLICY IF EXISTS "Authenticated can delete groups" ON public.task_groups;
DROP POLICY IF EXISTS "Public groups are viewable for public boards" ON public.task_groups;

CREATE POLICY "Task groups SELECT access" ON public.task_groups FOR SELECT TO authenticated USING (public.can_access_board(board_id, auth.uid()));
CREATE POLICY "Task groups SELECT public anon" ON public.task_groups FOR SELECT TO anon USING (public.is_public_board(board_id));
CREATE POLICY "Task groups WRITE access" ON public.task_groups FOR ALL TO authenticated USING (public.can_access_board(board_id, auth.uid())) WITH CHECK (public.can_access_board(board_id, auth.uid()));

-- CUSTOM_FIELDS
DROP POLICY IF EXISTS "Authenticated can view custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Authenticated can create custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Authenticated can update custom fields" ON public.custom_fields;
DROP POLICY IF EXISTS "Authenticated can delete custom fields" ON public.custom_fields;

CREATE POLICY "Custom fields access control" ON public.custom_fields FOR ALL TO authenticated USING (public.can_access_board(board_id, auth.uid())) WITH CHECK (public.can_access_board(board_id, auth.uid()));

-- AUTOMATION_RULES
DROP POLICY IF EXISTS "Authenticated can view automations" ON public.automation_rules;
DROP POLICY IF EXISTS "Authenticated can create automations" ON public.automation_rules;
DROP POLICY IF EXISTS "Authenticated can update automations" ON public.automation_rules;
DROP POLICY IF EXISTS "Authenticated can delete automations" ON public.automation_rules;

CREATE POLICY "Automation rules access control" ON public.automation_rules FOR ALL TO authenticated USING (public.can_access_board(board_id, auth.uid())) WITH CHECK (public.can_access_board(board_id, auth.uid()));

-- TASK_COMMENTS (Não tem board_id direto)
CREATE OR REPLACE FUNCTION public.can_access_task_by_id(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_access_board(board_id, _user_id) FROM public.tasks WHERE id = _task_id;
$$;

DROP POLICY IF EXISTS "Authenticated can view comments" ON public.task_comments;
DROP POLICY IF EXISTS "Authenticated can create comments" ON public.task_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.task_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.task_comments;

CREATE POLICY "Task comments SELECT access" ON public.task_comments FOR SELECT TO authenticated USING (public.can_access_task_by_id(task_id, auth.uid()));
CREATE POLICY "Task comments WRITE access" ON public.task_comments FOR ALL TO authenticated USING (public.can_access_task_by_id(task_id, auth.uid())) WITH CHECK (public.can_access_task_by_id(task_id, auth.uid()));

-- TASK_CUSTOM_VALUES
DROP POLICY IF EXISTS "Authenticated can view task custom values" ON public.task_custom_values;
DROP POLICY IF EXISTS "Authenticated can create task custom values" ON public.task_custom_values;
DROP POLICY IF EXISTS "Authenticated can update task custom values" ON public.task_custom_values;
DROP POLICY IF EXISTS "Authenticated can delete task custom values" ON public.task_custom_values;

CREATE POLICY "Task custom values access control" ON public.task_custom_values FOR ALL TO authenticated USING (public.can_access_task_by_id(task_id, auth.uid())) WITH CHECK (public.can_access_task_by_id(task_id, auth.uid()));
