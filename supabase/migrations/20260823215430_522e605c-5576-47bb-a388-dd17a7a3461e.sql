-- REFORÇO DE SEGURANÇA E CORREÇÕES DE AUTENTICAÇÃO (FASE 2)
-- Rollback SQL (execute para reverter esta migration):
/*
DROP FUNCTION IF EXISTS public.shares_project_with(uuid, uuid);
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$ ... (restaurar versão anterior do handle_new_user) ... $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP POLICY IF EXISTS "Profiles access control" ON public.profiles;
CREATE POLICY "Profiles access control" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.user_id = auth.uid()));
*/

-- 1. FUNÇÃO PARA VERIFICAR PROJETOS EM COMUM (SEM RLS)
CREATE OR REPLACE FUNCTION public.shares_project_with(_other_user_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.project_members pm1
    JOIN public.project_members pm2 ON pm1.board_id = pm2.board_id
    WHERE pm1.user_id = _user_id 
      AND pm2.user_id = _other_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.shares_project_with(uuid, uuid) TO authenticated;

-- 2. REESCRITA DA POLICY DE PROFILES (EVITANDO RECURSÃO)
DROP POLICY IF EXISTS "Profiles access control" ON public.profiles;
CREATE POLICY "Profiles access control" ON public.profiles
  FOR SELECT 
  TO authenticated 
  USING (
    auth.uid() = user_id 
    OR public.is_admin_or_coordinator(auth.uid())
    OR public.shares_project_with(user_id, auth.uid())
  );

-- 3. CORREÇÃO DA claim_invitation (VALIDAÇÃO DE SESSÃO)
CREATE OR REPLACE FUNCTION public.claim_invitation(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _invitation_id uuid;
    _role app_role;
BEGIN
    -- Validação de autenticação
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'É necessário estar autenticado para aceitar o convite';
    END IF;

    -- Busca convite válido
    SELECT id, role INTO _invitation_id, _role
    FROM public.invitations
    WHERE token = _token 
      AND used_at IS NULL 
      AND (expires_at > now() OR expires_at IS NULL);

    IF _invitation_id IS NULL THEN
        RAISE EXCEPTION 'Convite inválido, expirado ou já utilizado';
    END IF;

    -- Atribui o papel
    INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), _role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Marca como usado
    UPDATE public.invitations
    SET used_at = now(),
        accepted_by = auth.uid()
    WHERE id = _invitation_id;
END;
$$;

-- 4. MELHORIA NO GATILHO handle_new_user (LOG DE FALHAS E DADOS EXTRA)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _invitation_token uuid;
    _full_name text;
    _dob date;
BEGIN
    -- Captura dados do metadado (e-mail/senha ou OAuth)
    -- Tenta converter para uuid apenas se não for nulo/vazio
    IF new.raw_user_meta_data->>'invitation_token' IS NOT NULL AND new.raw_user_meta_data->>'invitation_token' <> '' THEN
        _invitation_token := (new.raw_user_meta_data->>'invitation_token')::uuid;
    END IF;
    
    _full_name := new.raw_user_meta_data->>'full_name';
    
    IF new.raw_user_meta_data->>'date_of_birth' IS NOT NULL AND new.raw_user_meta_data->>'date_of_birth' <> '' THEN
        _dob := (new.raw_user_meta_data->>'date_of_birth')::date;
    END IF;

    -- Cria o perfil base
    INSERT INTO public.profiles (user_id, full_name, date_of_birth, avatar_url)
    VALUES (
        new.id, 
        COALESCE(_full_name, new.raw_user_meta_data->>'name', 'Usuário Novo'),
        _dob,
        new.raw_user_meta_data->>'avatar_url'
    );

    -- Tenta processar o convite se houver token
    IF _invitation_token IS NOT NULL THEN
        BEGIN
            -- Simula o claim_invitation internamente
            INSERT INTO public.user_roles (user_id, role)
            SELECT new.id, role
            FROM public.invitations
            WHERE token = _invitation_token 
              AND used_at IS NULL 
              AND (expires_at > now() OR expires_at IS NULL);

            UPDATE public.invitations
            SET used_at = now(),
                accepted_by = new.id
            WHERE token = _invitation_token 
              AND used_at IS NULL 
              AND (expires_at > now() OR expires_at IS NULL);
              
        EXCEPTION WHEN OTHERS THEN
            -- Log da falha em vez de engolir o erro
            INSERT INTO public.activity_log (user_id, action, details)
            VALUES (new.id, 'Falha ao processar convite', jsonb_build_object(
                'token', _invitation_token,
                'error', SQLERRM,
                'hint', 'O usuário foi criado mas o papel do convite não foi atribuído.'
            ));
            RAISE WARNING 'Falha ao processar convite para usuário % (Token: %): %', new.id, _invitation_token, SQLERRM;
        END;
    END IF;

    RETURN new;
END;
$$;
