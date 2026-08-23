-- 2. PERMISSÃO DE EXECUÇÃO FALTANDO NAS FUNÇÕES DE SEGURANÇA.

-- Conceder EXECUTE para funções internas (apenas authenticated e service_role)
GRANT EXECUTE ON FUNCTION public.can_access_board(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_task_by_id(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_invitation(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_coordinator(uuid) TO authenticated, service_role;

-- Conceder EXECUTE para funções usadas em rotas públicas (authenticated, service_role e anon)
GRANT EXECUTE ON FUNCTION public.is_public_board(uuid) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.validate_invitation(text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.shares_project_with(uuid, uuid) TO authenticated, service_role, anon;
