GRANT SELECT ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;
GRANT SELECT ON public.boards TO anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, anon;