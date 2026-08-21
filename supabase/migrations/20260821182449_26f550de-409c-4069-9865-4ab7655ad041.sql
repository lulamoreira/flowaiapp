DROP POLICY IF EXISTS "Authenticated can view boards" ON public.boards;
CREATE POLICY "Authenticated can view boards" ON public.boards
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR public.is_project_member(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'coordinator')
);