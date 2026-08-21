CREATE TABLE public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(board_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can manage all project members"
ON public.project_members
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner')
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner')
);

CREATE POLICY "Users can view members of projects they belong to"
ON public.project_members
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE board_id = project_members.board_id 
          AND user_id = auth.uid()
    ) OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'coordinator')
);