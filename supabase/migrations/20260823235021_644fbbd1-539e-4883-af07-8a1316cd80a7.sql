-- UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_intake_enabled(p_board_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.intake_forms 
    WHERE board_id = p_board_id AND enabled = true
  );
$function$;

-- TABLE PERMISSIONS (GRANTS)
GRANT SELECT ON public.intake_forms TO anon;
GRANT SELECT ON public.custom_fields TO anon;
GRANT INSERT ON public.tasks TO anon;
GRANT INSERT ON public.task_custom_values TO anon;

-- RLS POLICIES CONSOLIDATION
DO $$ 
BEGIN
    -- custom_functions
    DROP POLICY IF EXISTS "Authenticated can view custom functions" ON public.custom_functions;
    DROP POLICY IF EXISTS "Privileged can manage custom functions" ON public.custom_functions;
    DROP POLICY IF EXISTS "custom_functions_admin" ON public.custom_functions;
    DROP POLICY IF EXISTS "custom_functions_select" ON public.custom_functions;
    DROP POLICY IF EXISTS "custom_functions_write" ON public.custom_functions;
    
    -- function_permissions
    DROP POLICY IF EXISTS "Authenticated can view function permissions" ON public.function_permissions;
    DROP POLICY IF EXISTS "Privileged can manage function permissions" ON public.function_permissions;
    DROP POLICY IF EXISTS "function_permissions_admin" ON public.function_permissions;
    DROP POLICY IF EXISTS "function_permissions_select" ON public.function_permissions;
    DROP POLICY IF EXISTS "function_permissions_write" ON public.function_permissions;
    
    -- user_custom_functions
    DROP POLICY IF EXISTS "user_custom_functions_admin" ON public.user_custom_functions;
    DROP POLICY IF EXISTS "user_custom_functions_select" ON public.user_custom_functions;
    DROP POLICY IF EXISTS "user_custom_functions_write" ON public.user_custom_functions;
    
    -- tasks (fix status)
    DROP POLICY IF EXISTS "tasks_insert_anon" ON public.tasks;
END $$;

-- 3.1 Custom Functions Management
ALTER TABLE public.custom_functions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_functions_select" ON public.custom_functions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "custom_functions_write" ON public.custom_functions
    FOR ALL TO authenticated
    USING (is_admin_or_coordinator(auth.uid()))
    WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- 3.2 Function Permissions Management
ALTER TABLE public.function_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "function_permissions_select" ON public.function_permissions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "function_permissions_write" ON public.function_permissions
    FOR ALL TO authenticated
    USING (is_admin_or_coordinator(auth.uid()))
    WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- 3.3 User-specific Custom Functions
ALTER TABLE public.user_custom_functions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_custom_functions_select" ON public.user_custom_functions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "user_custom_functions_write" ON public.user_custom_functions
    FOR ALL TO authenticated
    USING (is_admin_or_coordinator(auth.uid()))
    WITH CHECK (is_admin_or_coordinator(auth.uid()));

-- 3.4 Tasks: Public Intake Fix
CREATE POLICY "tasks_insert_anon" ON public.tasks
    FOR INSERT TO anon
    WITH CHECK (
        is_intake_enabled(board_id) 
        AND assignee IS NULL 
        AND status = 'not_started'::text
        AND planned_start IS NULL AND planned_end IS NULL
        AND actual_start IS NULL AND actual_end IS NULL
    );
