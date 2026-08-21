DROP POLICY IF EXISTS "Authenticated can view boards" ON public.boards;
CREATE POLICY "Authenticated can view boards" ON public.boards
FOR SELECT
TO authenticated
USING (true);