-- 1. FIX SEARCH PATH FOR REMAINING SECURITY DEFINER FUNCTIONS
ALTER FUNCTION public.sync_profile_email() SET search_path = public;
ALTER FUNCTION public.handle_new_board_member() SET search_path = public;

-- 2. FIX RLS FOR TABLES WITHOUT POLICIES
ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "internal_secrets_service_only" ON public.internal_secrets;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "internal_secrets_service_only" ON public.internal_secrets
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "stripe_events_privileged" ON public.stripe_events;
    DROP POLICY IF EXISTS "stripe_events_service" ON public.stripe_events;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "stripe_events_privileged" ON public.stripe_events
    FOR SELECT TO authenticated
    USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

CREATE POLICY "stripe_events_service" ON public.stripe_events
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. ENSURE ALL SECURITY DEFINER FUNCTIONS HAVE REVOKED PUBLIC EXECUTE
DO $$ 
DECLARE 
    func_name TEXT;
    param_types TEXT;
BEGIN
    FOR func_name, param_types IN 
        SELECT proname, pg_get_function_identity_arguments(p.oid)
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.prosecdef = true
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', func_name, param_types);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', func_name, param_types);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', func_name, param_types);
    END LOOP;
END $$;

-- Specifically allow anon for intake/public board functions
GRANT EXECUTE ON FUNCTION public.is_intake_enabled(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_public_board(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.claim_invitation(uuid) TO anon;
