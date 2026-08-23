-- 1. Remover agendamentos antigos que faziam apenas backup local
SELECT cron.unschedule('backup-morning');
SELECT cron.unschedule('backup-afternoon');

-- 2. Recriar agendamentos chamando a Edge Function (que internamente chama create_backup)
-- 9h Brasília (UTC-3) = 12h UTC
SELECT cron.schedule(
    'backup-morning',
    '0 12 * * *',
    $$
    SELECT net.http_post(
        url := 'https://oprfcycipohpktitivhl.supabase.co/functions/v1/backup-to-drive',
        headers := '{"Content-Type": "application/json", "x-cron-secret": "f2a481826019cb2698789106923ce7de154e07a6ac77bbe99d0a60f50d69c844"}'::jsonb
    );
    $$
);

-- 18h Brasília (UTC-3) = 21h UTC
SELECT cron.schedule(
    'backup-afternoon',
    '0 21 * * *',
    $$
    SELECT net.http_post(
        url := 'https://oprfcycipohpktitivhl.supabase.co/functions/v1/backup-to-drive',
        headers := '{"Content-Type": "application/json", "x-cron-secret": "f2a481826019cb2698789106923ce7de154e07a6ac77bbe99d0a60f50d69c844"}'::jsonb
    );
    $$
);
