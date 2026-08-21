-- Fix infinite recursion in project_members RLS policy
DROP POLICY IF EXISTS "Users can view members of projects they belong to" ON public.project_members;

CREATE POLICY "Users can view members of projects they belong to"
ON public.project_members
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'coordinator')
);
