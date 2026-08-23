# Plano de Integração: Backup Automático no Google Drive

Implementação de backup off-site para o Google Drive com agendamento via `pg_cron` e execução via Edge Functions, incluindo gestão de segredos e interface administrativa.

## 1. Configuração de Segurança e Segredos
- Gerar um `BACKUP_CRON_SECRET` aleatório e seguro.
- Armazenar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` e `BACKUP_CRON_SECRET` no backend via ferramenta de segredos do Lovable Cloud.
- Criar a tabela `public.app_settings` para persistir o `gdrive_backup_folder_id` e status do último backup.

## 2. Desenvolvimento da Edge Function `backup-to-drive`
- **Autenticação:** Troca do Refresh Token por Access Token (Google OAuth2).
- **Gestão de Pasta:** Localizar ou criar a pasta "FlowAI Backups".
- **Geração de Dados:** Invocar a função SQL `create_backup('cron_drive')` para obter o snapshot mais recente.
- **Upload:** Envio do JSON via multipart upload para o Google Drive.
- **Retenção:** Implementar limpeza lógica (7 dias / manter 5 últimos) diretamente na API do Drive.
- **Segurança:** Configurar `verify_jwt = false` e validar o `BACKUP_CRON_SECRET` no header `X-Cron-Secret`.

## 3. Automação no Banco de Dados
- Criar tabela `app_settings` com RLS restrito.
- Atualizar os jobs do `pg_cron` para invocar a Edge Function via `net.http_post` (usando `pg_net`), eliminando redundância de chamadas diretas.

## 4. Atualização da Interface Administrativa
- Adicionar controles de backup manual para o Drive na aba "Backups".
- Exibir indicadores de status de sincronização e logs de erros visíveis.
- Implementar download de JSON local (conforme solicitado anteriormente mas garantindo integração).

## Detalhes Técnicos
- **Stack:** Deno (Edge Function), PostgreSQL (pg_cron, pg_net), React (Admin UI).
- **Escopo OAuth:** `https://www.googleapis.com/auth/drive.file`.
- **Fuso Horário:** Conversão explícita para Horário de Brasília (UTC-3) no nome do arquivo e logs.

## Verificações
- Deploy da função e teste de conectividade (evitar 404).
- Execução de teste manual com verificação de arquivo no Drive.
- Inspeção da tabela `cron.job` para validar agendamentos.
