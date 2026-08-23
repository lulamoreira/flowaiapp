-- Restringir execução da função proxy
REVOKE ALL ON FUNCTION public.trigger_drive_backup() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_drive_backup() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_drive_backup() TO service_role;

-- Satisfazer o linter para a tabela de segredos (embora já esteja protegida pelo RLS sem políticas)
-- Criamos uma política que não permite nada para ninguém exceto service_role (que ignora RLS)
CREATE POLICY "No one can see secrets" ON public.internal_secrets FOR ALL TO authenticated USING (false);
