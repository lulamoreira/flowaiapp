-- Migration: Endurecimento de RLS e Segurança de Acesso
-- Descrição: Remove políticas permissivas, endurece tabelas críticas e configura search_path seguro.
-- Data: 2026-08-23

-- 1. LIMPEZA DE POLICIES PERMISSIVAS ANTIGAS
-- Reversão: CREATE POLICY ... USING (true)
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone authenticated can view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated can view time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Authenticated can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated can view intake forms" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated users can select all snapshots" ON public.schedule_snapshots;
DROP POLICY IF EXISTS "authenticated_select" ON public.placeholder_members;
DROP POLICY IF EXISTS "Authenticated can view custom functions" ON public.custom_functions;
DROP POLICY IF EXISTS "Authenticated can view permissions" ON public.function_permissions;
DROP POLICY IF EXISTS "Authenticated can view assignments" ON public.user_custom_functions;

-- 2. ENDURECIMENTO DE TABELAS

-- a) time_entries
-- Reversão: DROP POLICY "Time entries access control" ON public.time_entries;
DROP POLICY IF EXISTS "Time entries access control" ON public.time_entries;
DROP POLICY IF EXISTS "Time entries insert control" ON public.time_entries;
DROP POLICY IF EXISTS "Time entries update control" ON public.time_entries;
DROP POLICY IF EXISTS "Time entries delete control" ON public.time_entries;
DROP POLICY IF EXISTS "Users can create own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can update own time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can delete own time entries" ON public.time_entries;

CREATE POLICY "Time entries access control" ON public.time_entries
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id OR 
  is_admin_or_coordinator(auth.uid()) OR 
  can_access_board((SELECT board_id FROM public.tasks WHERE id = task_id), auth.uid())
);

CREATE POLICY "Time entries insert control" ON public.time_entries
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Time entries update control" ON public.time_entries
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR is_admin_or_coordinator(auth.uid()))
WITH CHECK (auth.uid() = user_id OR is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Time entries delete control" ON public.time_entries
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR is_admin_or_coordinator(auth.uid()));

-- b) user_roles
-- Reversão: DROP POLICY "User roles select control" ON public.user_roles;
DROP POLICY IF EXISTS "User roles select control" ON public.user_roles;
DROP POLICY IF EXISTS "User roles admin control" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "User roles select control" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_admin_or_coordinator(auth.uid()));

CREATE POLICY "User roles admin control" ON public.user_roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- c) intake_forms
-- Reversão: DROP POLICY "Intake forms select control" ON public.intake_forms;
DROP POLICY IF EXISTS "Intake forms select control" ON public.intake_forms;
DROP POLICY IF EXISTS "Intake forms manage control" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated can manage intake forms" ON public.intake_forms;
DROP POLICY IF EXISTS "Authenticated can update intake forms" ON public.intake_forms;

CREATE POLICY "Intake forms select control" ON public.intake_forms
FOR SELECT TO authenticated
USING (can_access_board(board_id, auth.uid()));

CREATE POLICY "Intake forms manage control" ON public.intake_forms
FOR ALL TO authenticated
USING (can_access_board(board_id, auth.uid()) AND (NOT has_role(auth.uid(), 'user'::app_role)))
WITH CHECK (can_access_board(board_id, auth.uid()) AND (NOT has_role(auth.uid(), 'user'::app_role)));

-- d) app_settings
-- Reversão: DROP POLICY "App settings select control" ON public.app_settings;
DROP POLICY IF EXISTS "App settings select control" ON public.app_settings;
DROP POLICY IF EXISTS "App settings manage control" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;

CREATE POLICY "App settings select control" ON public.app_settings
FOR SELECT TO authenticated
USING (is_admin_or_coordinator(auth.uid()) OR has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "App settings manage control" ON public.app_settings
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- e) Storage (Bucket 'task-attachments')
-- Reversão: DROP POLICY ... ON storage.objects;
DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
    CREATE POLICY "Authenticated users can view attachments" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'task-attachments' AND 
        can_access_board((SELECT board_id FROM public.tasks WHERE id::text = split_part(name, '/', 1) LIMIT 1), auth.uid())
    );

    DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
    CREATE POLICY "Authenticated users can upload attachments" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'task-attachments' AND 
        can_access_board((SELECT board_id FROM public.tasks WHERE id::text = split_part(name, '/', 1) LIMIT 1), auth.uid())
    );

    DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;
    CREATE POLICY "Authenticated users can delete attachments" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'task-attachments' AND 
        can_access_board((SELECT board_id FROM public.tasks WHERE id::text = split_part(name, '/', 1) LIMIT 1), auth.uid())
    );
END $$;

-- 3. TRAVA DO FORMULÁRIO PÚBLICO (Tasks)
-- Reversão: DROP POLICY "Anon can create tasks via forms restricted" ON public.tasks;
DROP POLICY IF EXISTS "Anon can create intake tasks" ON public.tasks;
DROP POLICY IF EXISTS "Anon can create tasks via forms" ON public.tasks;
DROP POLICY IF EXISTS "Tasks intake INSERT access" ON public.tasks;
DROP POLICY IF EXISTS "Tasks INSERT access" ON public.tasks;
DROP POLICY IF EXISTS "Anon can create tasks via forms restricted" ON public.tasks;

CREATE POLICY "Anon can create tasks via forms restricted" ON public.tasks
FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.intake_forms 
    WHERE intake_forms.board_id = tasks.board_id 
    AND intake_forms.enabled = true
  )
  AND assignee IS NULL
  AND status = 'todo'
  AND planned_start IS NULL
  AND planned_end IS NULL
  AND actual_start IS NULL
  AND actual_end IS NULL
);

-- 4. AJUSTES DE SEARCH_PATH (SECURITY DEFINER)
-- Reversão: ALTER FUNCTION ... RESET search_path;
ALTER FUNCTION public.can_access_board(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.is_admin_or_coordinator(uuid) SET search_path = public;
ALTER FUNCTION public.shares_project_with(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_public_board(uuid) SET search_path = public;
ALTER FUNCTION public.can_access_task_by_id(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.get_board_id_from_task(uuid) SET search_path = public;
ALTER FUNCTION public.is_project_member(uuid, uuid) SET search_path = public;
