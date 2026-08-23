-- 1. Remover agendamentos antigos que faziam apenas backup local
SELECT cron.unschedule('backup-morning');
SELECT cron.unschedule('backup-afternoon');

-- [SEGURANÇA] O bloco anterior que configurava o net.http_post com o segredo exposto foi removido.
-- O agendamento correto agora é feito via função proxy public.trigger_drive_backup() 
-- implementada na migration seguinte para garantir que segredos não fiquem em texto puro.
