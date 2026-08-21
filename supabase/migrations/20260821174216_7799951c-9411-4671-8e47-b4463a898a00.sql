GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

REVOKE ALL ON FUNCTION public.is_project_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.claim_placeholder(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_placeholder(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_placeholder(uuid, uuid) TO service_role;
