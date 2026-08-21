-- 1. Certificar que as funções de segurança existem e estão corretas
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

-- 2. Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, anon;

-- 3. Recriar a política de SELECT para boards com redundância de segurança
DROP POLICY IF EXISTS "Boards visibility policy" ON public.boards;
DROP POLICY IF EXISTS "Boards are viewable by members or admins" ON public.boards;
DROP POLICY IF EXISTS "Users can view boards they are members of" ON public.boards;

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

-- 4. Garantir que o criador do board 'VITRINE ESPECIAL LINDT GRAMADO' esteja em project_members se não estiver
INSERT INTO public.project_members (board_id, user_id)
SELECT id, created_by
FROM public.boards
WHERE id = '8acfd298-c196-4d47-ac3d-56ed3c8282fb'
ON CONFLICT DO NOTHING;

-- 5. Grant total em boards para service_role e select para authenticated
GRANT ALL ON public.boards TO service_role;
GRANT SELECT ON public.boards TO authenticated;
GRANT SELECT ON public.boards TO anon;