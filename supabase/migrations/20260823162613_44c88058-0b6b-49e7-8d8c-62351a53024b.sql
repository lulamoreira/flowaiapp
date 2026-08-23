-- 1. Tabela para segredos internos
CREATE TABLE IF NOT EXISTS public.internal_secrets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Apenas service_role pode ver/editar
ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.internal_secrets TO service_role;

-- 2. Função Proxy
CREATE OR REPLACE FUNCTION public.trigger_drive_backup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_secret TEXT;
BEGIN
    SELECT value INTO v_secret FROM public.internal_secrets WHERE key = 'backup_cron_secret';
    
    IF v_secret IS NULL THEN
        RAISE EXCEPTION 'Secret backup_cron_secret not found in internal_secrets table';
    END IF;

    PERFORM net.http_post(
        url := 'https://oprfcycipohpktitivhl.supabase.co/functions/v1/backup-to-drive',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', v_secret
        )
    );
END;
$$;

-- 3. Configurar agendamentos
-- Garantir limpeza de jobs antigos
DO $$ 
BEGIN
    PERFORM cron.unschedule('backup-morning');
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

DO $$ 
BEGIN
    PERFORM cron.unschedule('backup-afternoon');
EXCEPTION WHEN OTHERS THEN 
    NULL;
END $$;

-- 9h Brasília (UTC-3) = 12h UTC
SELECT cron.schedule('backup-morning', '0 12 * * *', 'SELECT public.trigger_drive_backup();');
-- 18h Brasília (UTC-3) = 21h UTC
SELECT cron.schedule('backup-afternoon', '0 21 * * *', 'SELECT public.trigger_drive_backup();');

-- 4. Popular o segredo
INSERT INTO public.internal_secrets (key, value)
VALUES ('backup_cron_secret', 'a375401624b786fb173609def82577576ed6060eb51a854ec1232096980d3375')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();