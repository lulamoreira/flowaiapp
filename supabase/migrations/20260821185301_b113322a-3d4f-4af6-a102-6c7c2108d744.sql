-- Correção final de permissões e visibilidade
-- 1. Restabelecer a função has_role corretamente
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 2. Restabelecer a função is_project_member corretamente
CREATE OR REPLACE FUNCTION public.is_project_member(_board_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE board_id = _board_id
      AND user_id = _user_id
  );
$$;

-- 3. Garantir execução apenas para authenticated e service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, service_role;

-- 4. Garantir que a política de SELECT use essas funções sem erros
DROP POLICY IF EXISTS "Boards visibility policy" ON public.boards;
CREATE POLICY "Boards visibility policy"
ON public.boards
FOR SELECT
TO authenticated
USING (
    created_by = auth.uid() 
    OR public.is_project_member(id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'coordinator')
);

-- 5. Grant SELECT em boards
GRANT SELECT ON public.boards TO authenticated;
GRANT SELECT ON public.boards TO anon; -- Necessário se houver rotas públicas que listam boards
GRANT ALL ON public.boards TO service_role;