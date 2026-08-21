-- 1. DEVOLVA O PAPEL admin E ATUALIZE is_admin_or_coordinator
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'lula1973@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin_or_coordinator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      and role IN ('admin', 'coordinator', 'owner')
  )
$$;

-- 2. PREENCHA O EMAIL NOS PERFIS E CORRIJA O NOME
-- Primeiro, garanta que profiles.email existe (já foi dito que foi criado, mas por segurança)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email = '');

-- Corrige o nome específico
UPDATE public.profiles
SET full_name = 'Luis Alberto Moreira'
WHERE email = 'lula1973@gmail.com';

-- 3. GARANTA O GATILHO handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$;
