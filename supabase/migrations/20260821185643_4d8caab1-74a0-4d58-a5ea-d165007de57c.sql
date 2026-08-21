-- Garantia absoluta do papel 'owner' para o proprietário no banco de dados
DELETE FROM public.user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'lula1973@gmail.com') AND role = 'viewer';
INSERT INTO public.user_roles (user_id, role) 
SELECT id, 'owner'::public.app_role
FROM auth.users 
WHERE email = 'lula1973@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Forçar atualização do nome no perfil para refletir a identidade correta
UPDATE public.profiles 
SET full_name = 'Luis Alberto Moreira'
WHERE email = 'lula1973@gmail.com';