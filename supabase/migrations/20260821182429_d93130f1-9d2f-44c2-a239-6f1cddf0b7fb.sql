DROP POLICY IF EXISTS "Authenticated can view boards" ON public.boards;
CREATE POLICY "Authenticated can view boards" ON public.boards
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE board_id = boards.id 
    AND user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'owner')
  OR public.has_role(auth.uid(), 'coordinator')
);