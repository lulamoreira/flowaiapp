-- FASE 1: ENDURECIMENTO DO RLS
-- Backup realizado: pre_rls_hardening

-- 1. FUNÇÃO DE ACESSO CENTRALIZADA
CREATE OR REPLACE FUNCTION public.can_access_board(_board_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = _user_id 
          AND role IN ('admin', 'owner', 'coordinator')
    ) OR EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE board_id = _board_id 
          AND user_id = _user_id
    ) OR EXISTS (
        SELECT 1 FROM public.boards
        WHERE id = _board_id 
          AND public_timeline_enabled = true
    );
$$;

-- 2. REESCRITA DE POLÍTICAS: BOARDS
DROP POLICY IF EXISTS "Authenticated can view boards" ON public.boards;
DROP POLICY IF EXISTS "Authenticated can create boards" ON public.boards;
DROP POLICY IF EXISTS "Authenticated can update boards" ON public.boards;
DROP POLICY IF EXISTS "Authenticated can delete boards" ON public.boards;

CREATE POLICY "Boards access control" ON public.boards
FOR ALL TO authenticated
USING (public.can_access_board(id, auth.uid()))
WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

CREATE POLICY "Anon can view public boards" ON public.boards
FOR SELECT TO anon
USING (public_timeline_enabled = true);

-- 3. REESCRITA DE POLÍTICAS: TASKS
DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can delete tasks" ON public.tasks;

CREATE POLICY "Tasks access control" ON public.tasks
FOR ALL TO authenticated
USING (public.can_access_board(board_id, auth.uid()))
WITH CHECK (public.can_access_board(board_id, auth.uid()));

CREATE POLICY "Anon can view public tasks" ON public.tasks
FOR SELECT TO anon
USING (public.can_access_board(board_id, NULL));

CREATE POLICY "Anon can create intake tasks" ON public.tasks
FOR INSERT TO anon
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.intake_forms
        WHERE board_id = tasks.board_id AND enabled = true
    )
);

-- 4. REESCRITA DE POLÍTICAS: PROJECT_MEMBERS
DROP POLICY IF EXISTS "Owners and admins can manage all project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view members of projects they belong to" ON public.project_members;

CREATE POLICY "Project members access control" ON public.project_members
FOR ALL TO authenticated
USING (public.can_access_board(board_id, auth.uid()))
WITH CHECK (public.is_admin_or_coordinator(auth.uid()));

-- 5. REESCRITA DE POLÍTICAS: PROFILES
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Profiles access control" ON public.profiles
FOR SELECT TO authenticated
USING (
    user_id = auth.uid() 
    OR public.is_admin_or_coordinator(auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.project_members pm1
        JOIN public.project_members pm2 ON pm1.board_id = pm2.board_id
        WHERE pm1.user_id = auth.uid() AND pm2.user_id = profiles.user_id
    )
);

CREATE POLICY "Profiles update control" ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- FASE 2: CONVITES E CADASTRO RESTRITO

-- 1. Alterar invitations
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'viewer';
ALTER TABLE public.invitations ALTER COLUMN email DROP NOT NULL;

UPDATE public.invitations SET role = 'viewer' WHERE status = 'pending';

-- 2. Corrigir vazamento de convites
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.invitations;

-- 3. RPCs de convite
CREATE OR REPLACE FUNCTION public.validate_invitation(_token uuid)
RETURNS TABLE (
    is_valid boolean,
    invited_name text,
    email text,
    role public.app_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (status = 'pending' AND expires_at > now()) as is_valid,
        invited_name,
        email,
        role
    FROM public.invitations
    WHERE token = _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_invitation(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inv record;
BEGIN
    SELECT * INTO v_inv FROM public.invitations 
    WHERE token = _token AND status = 'pending' AND expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite inválido ou expirado';
    END IF;

    IF v_inv.email IS NOT NULL AND v_inv.email != (SELECT email FROM auth.users WHERE id = auth.uid()) THEN
        RAISE EXCEPTION 'Este convite é destinado a outro e-mail';
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), v_inv.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.invitations 
    SET status = 'accepted', accepted_at = now()
    WHERE token = _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_invitation_by_user(_token uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inv record;
BEGIN
    SELECT * INTO v_inv FROM public.invitations 
    WHERE token = _token AND status = 'pending' AND expires_at > now();

    IF FOUND THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (_user_id, v_inv.role)
        ON CONFLICT (user_id, role) DO NOTHING;

        UPDATE public.invitations 
        SET status = 'accepted', accepted_at = now()
        WHERE token = _token;
    END IF;
END;
$$;

-- 4. Ajustar handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_token_str text;
    v_token uuid;
BEGIN
    INSERT INTO public.profiles (user_id, full_name, avatar_url, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.email
    );

    v_token_str := NEW.raw_user_meta_data->>'invitation_token';
    
    IF v_token_str IS NOT NULL THEN
        BEGIN
            v_token := v_token_str::uuid;
            PERFORM public.process_invitation_by_user(v_token, NEW.id);
        EXCEPTION WHEN others THEN
            NULL;
        END;
    END IF;

    RETURN NEW;
END;
$$;