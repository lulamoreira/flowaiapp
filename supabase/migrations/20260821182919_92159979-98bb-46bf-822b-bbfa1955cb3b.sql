DROP POLICY IF EXISTS "Authenticated can view boards" ON public.boards;
CREATE POLICY "Authenticated can view boards" ON public.boards
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR 
  public.is_project_member(id, auth.uid()) OR 
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'owner') OR 
  public.has_role(auth.uid(), 'coordinator')
);

CREATE OR REPLACE FUNCTION public.handle_new_board_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.project_members (board_id, user_id)
  VALUES (NEW.id, NEW.created_by)
  ON CONFLICT (board_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_board_created ON public.boards;
CREATE TRIGGER on_board_created
  AFTER INSERT ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_board_member();