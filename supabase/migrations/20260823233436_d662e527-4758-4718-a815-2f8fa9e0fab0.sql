-- MIGRATION: 20260823234500_rebuild_rls_from_scratch.sql
-- DESCRIPTION: Rebuilds all RLS policies for the public schema from scratch.

-- 1. CLEANUP: Drop all existing policies in the public schema
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. POLICIES REBUILD

-------------------------------------------------------------------------------
-- boards
-------------------------------------------------------------------------------
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boards_select" ON public.boards
    FOR SELECT TO authenticated
    USING (is_admin_or_coordinator(auth.uid()) OR is_project_member(id, auth.uid()));

CREATE POLICY "boards_select_anon" ON public.boards
    FOR SELECT TO anon
    USING (public_timeline_enabled = true);

CREATE POLICY "boards_write" ON public.boards
    FOR ALL TO authenticated
    USING (is_admin_or_coordinator(auth.uid()))
    WITH CHECK (is_admin_or_coordinator(auth.uid()));

-------------------------------------------------------------------------------
-- task_groups, tasks, custom_fields, automation_rules, intake_forms
-------------------------------------------------------------------------------
-- All conditioned to can_access_board(board_id, auth.uid())

-- task_groups
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_groups_access" ON public.task_groups
    FOR ALL TO authenticated
    USING (can_access_board(board_id, auth.uid()))
    WITH CHECK (can_access_board(board_id, auth.uid()));

CREATE POLICY "task_groups_select_anon" ON public.task_groups
    FOR SELECT TO anon
    USING (is_public_board(board_id));

-- tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_access" ON public.tasks
    FOR ALL TO authenticated
    USING (can_access_board(board_id, auth.uid()))
    WITH CHECK (can_access_board(board_id, auth.uid()));

CREATE POLICY "tasks_select_anon" ON public.tasks
    FOR SELECT TO anon
    USING (is_public_board(board_id));

CREATE POLICY "tasks_insert_anon" ON public.tasks
    FOR INSERT TO anon
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.intake_forms WHERE board_id = tasks.board_id AND enabled = true)
        AND assignee IS NULL 
        AND status = 'todo'::text
        AND planned_start IS NULL AND planned_end IS NULL
        AND actual_start IS NULL AND actual_end IS NULL
    );

-- custom_fields
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_fields_access" ON public.custom_fields
    FOR ALL TO authenticated
    USING (can_access_board(board_id, auth.uid()))
    WITH CHECK (can_access_board(board_id, auth.uid()));

CREATE POLICY "custom_fields_select_anon" ON public.custom_fields
    FOR SELECT TO anon
    USING (is_public_board(board_id));

-- automation_rules
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_access" ON public.automation_rules
    FOR ALL TO authenticated
    USING (can_access_board(board_id, auth.uid()))
    WITH CHECK (can_access_board(board_id, auth.uid()));

-- intake_forms
ALTER TABLE public.intake_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intake_forms_access" ON public.intake_forms
    FOR ALL TO authenticated
    USING (can_access_board(board_id, auth.uid()))
    WITH CHECK (can_access_board(board_id, auth.uid()));

-------------------------------------------------------------------------------
-- task_comments, task_custom_values
-------------------------------------------------------------------------------
-- Conditioned to can_access_task_by_id(task_id, auth.uid())

-- task_comments
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_comments_access" ON public.task_comments
    FOR ALL TO authenticated
    USING (can_access_task_by_id(task_id, auth.uid()))
    WITH CHECK (can_access_task_by_id(task_id, auth.uid()));

-- task_custom_values
ALTER TABLE public.task_custom_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_custom_values_access" ON public.task_custom_values
    FOR ALL TO authenticated
    USING (can_access_task_by_id(task_id, auth.uid()))
    WITH CHECK (can_access_task_by_id(task_id, auth.uid()));

CREATE POLICY "task_custom_values_insert_anon" ON public.task_custom_values
    FOR INSERT TO anon
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks t 
            JOIN public.intake_forms f ON f.board_id = t.board_id 
            WHERE t.id = task_id AND f.enabled = true
        )
    );

-------------------------------------------------------------------------------
-- project_members
-------------------------------------------------------------------------------
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members_select" ON public.project_members
    FOR SELECT TO authenticated
    USING (is_admin_or_coordinator(auth.uid()) OR is_project_member(board_id, auth.uid()));

CREATE POLICY "project_members_write" ON public.project_members
    FOR ALL TO authenticated
    USING (
        is_admin_or_coordinator(auth.uid()) OR 
        EXISTS (SELECT 1 FROM public.boards WHERE id = board_id AND created_by = auth.uid())
    )
    WITH CHECK (
        is_admin_or_coordinator(auth.uid()) OR 
        EXISTS (SELECT 1 FROM public.boards WHERE id = board_id AND created_by = auth.uid())
    );

-------------------------------------------------------------------------------
-- profiles
-------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR 
        is_admin_or_coordinator(auth.uid()) OR 
        shares_project_with(user_id, auth.uid())
    );

CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_insert" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-------------------------------------------------------------------------------
-- user_roles
-------------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR is_admin_or_coordinator(auth.uid()));

CREATE POLICY "user_roles_write" ON public.user_roles
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

-------------------------------------------------------------------------------
-- placeholder_members
-------------------------------------------------------------------------------
ALTER TABLE public.placeholder_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "placeholder_members_select" ON public.placeholder_members
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "placeholder_members_write" ON public.placeholder_members
    FOR ALL TO authenticated
    USING (is_admin_or_coordinator(auth.uid()))
    WITH CHECK (is_admin_or_coordinator(auth.uid()));

-------------------------------------------------------------------------------
-- invitations
-------------------------------------------------------------------------------
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_privileged" ON public.invitations
    FOR ALL TO authenticated
    USING (is_admin_or_coordinator(auth.uid()))
    WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- No direct select/write for others. validate_invitation/claim_invitation are SECURITY DEFINER.

-------------------------------------------------------------------------------
-- time_entries
-------------------------------------------------------------------------------
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_individual" ON public.time_entries
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "time_entries_privileged" ON public.time_entries
    FOR SELECT TO authenticated
    USING (is_admin_or_coordinator(auth.uid()));

-------------------------------------------------------------------------------
-- notifications
-------------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_owner" ON public.notifications
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-------------------------------------------------------------------------------
-- activity_log
-------------------------------------------------------------------------------
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_insert" ON public.activity_log
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "activity_log_select" ON public.activity_log
    FOR SELECT TO authenticated
    USING (is_admin_or_coordinator(auth.uid()));

-------------------------------------------------------------------------------
-- app_settings
-------------------------------------------------------------------------------
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_admin" ON public.app_settings
    FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
    WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

-------------------------------------------------------------------------------
-- backup_snapshots, deletion_log, schedule_snapshots
-------------------------------------------------------------------------------

-- backup_snapshots
ALTER TABLE public.backup_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_snapshots_admin" ON public.backup_snapshots
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

-- deletion_log
ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deletion_log_admin" ON public.deletion_log
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

-- schedule_snapshots
ALTER TABLE public.schedule_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_snapshots_admin" ON public.schedule_snapshots
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

-------------------------------------------------------------------------------
-- subscriptions, stripe_plans, stripe_events
-------------------------------------------------------------------------------

-- subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_owner" ON public.subscriptions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- stripe_plans (Publicly readable)
ALTER TABLE public.stripe_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stripe_plans_select" ON public.stripe_plans
    FOR SELECT TO authenticated
    USING (true);

-------------------------------------------------------------------------------
-- Storage policies
-------------------------------------------------------------------------------
-- Requires specific storage schema interaction, generally handled via dashboard,
-- but standard RLS for storage.objects can be set here.
-- Skipping explicit storage policy creation here as it often requires complex setup.

/*
REVERSAL SQL:
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;
*/
