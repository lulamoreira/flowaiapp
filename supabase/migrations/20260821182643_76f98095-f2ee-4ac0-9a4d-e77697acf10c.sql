DROP POLICY IF EXISTS "Authenticated can view boards" ON public.boards;
CREATE POLICY "Authenticated can view boards" ON public.boards
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'owner') OR 
  public.has_role(auth.uid(), 'coordinator') OR
  public.is_project_member(id, auth.uid())
);

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, anon;