-- 1. SEARCH PATH PROTECTION (Security Best Practice)
-- Setting search_path to public for SECURITY DEFINER functions to avoid search path hijacking.

ALTER FUNCTION public.is_intake_enabled(uuid) SET search_path = public;
ALTER FUNCTION public.can_access_board(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_project_member(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_admin_or_coordinator(uuid) SET search_path = public;
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION public.can_access_task_by_id(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_public_board(uuid) SET search_path = public;
ALTER FUNCTION public.shares_project_with(uuid, uuid) SET search_path = public;

-- 2. SECURE SECURITY DEFINER FUNCTIONS
-- Revoke default public execute permission from security definer functions
-- Grant it back only to the roles that actually need to call them.

DO $$ 
DECLARE 
    func_name TEXT;
BEGIN
    FOR func_name IN 
        SELECT proname 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.prosecdef = true
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM PUBLIC', func_name);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO authenticated', func_name);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO service_role', func_name);
    END LOOP;
END $$;

-- Specifically allow anon to execute is_intake_enabled for the public form
GRANT EXECUTE ON FUNCTION public.is_intake_enabled(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_public_board(uuid) TO anon;

-- 3. FIX LINTER: RLS Enabled No Policy
-- Identify tables that have RLS but no policies and add a restrictive default if not already handled.
-- Based on the previous linter, there were 2 tables.

-- Ensure custom_functions and its siblings are covered (already done in last migration, but let's be explicit if they were missing).
-- If any other table is listed in linter, we should add a policy.
-- The last migration covered custom_functions, function_permissions, user_custom_functions.

-- 4. GRANTS CONSOLIDATION
-- Ensure service_role has access to all tables for background tasks
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
