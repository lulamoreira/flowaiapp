-- Garantir que o usuário proprietário tenha o papel 'owner' no banco
INSERT INTO public.user_roles (user_id, role) 
SELECT id, 'owner'::public.app_role
FROM auth.users 
WHERE email = 'lula1973@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Garantir também que o perfil tenha o nome correto se estiver vazio
UPDATE public.profiles 
SET full_name = 'Luis Alberto Moreira'
WHERE email = 'lula1973@gmail.com' AND (full_name IS NULL OR full_name = '' OR full_name = 'Usuário');