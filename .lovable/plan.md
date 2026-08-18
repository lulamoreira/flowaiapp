---
title: Etapa A - Fundação Stripe e Segurança das Edge Functions
---

# Etapa A: Configuração de Segurança e Preparações Stripe

Nesta etapa, focamos na segurança e na fundação técnica para a integração com o Stripe, seguindo as diretrizes rigorosas para evitar vazamento de segredos e garantir a integridade do sistema.

## 1. Segurança de Segredos (Secrets)
As chaves sensíveis do Stripe serão armazenadas exclusivamente como **Secrets do Backend** (Edge Functions), nunca no repositório ou no bundle do frontend.
- `STRIPE_SECRET_KEY`: Chave secreta da conta Stripe (Test/Live).
- `STRIPE_WEBHOOK_SECRET`: Segredo para validar a assinatura dos webhooks.

## 2. Configuração das Edge Functions
Ajuste do `supabase/config.toml` para garantir que os webhooks funcionem corretamente:
- `stripe-webhook`: `verify_jwt = false` (Permite que o Stripe envie eventos sem um token Supabase).
- `stripe-checkout`: `verify_jwt = true` (Garante que apenas usuários autenticados possam criar sessões de pagamento).

## 3. Robustez do Webhook
Implementação de validação de assinatura no `stripe-webhook`:
- Uso de `stripe.webhooks.constructEventAsync` para garantir que a requisição veio do Stripe.
- Controle de idempotência para evitar processamento duplicado de eventos.

## 4. Integridade de Preços
A função `stripe-checkout` será configurada para aceitar apenas um ID de plano (ex: 'pro', 'basic').
- O `price_id` real e o valor serão resolvidos no servidor (banco de dados ou lógica interna), impedindo que o usuário manipule preços via navegador.

## 5. Manutenção do Paywall
- `paywall_active` permanecerá em `false` durante todo o desenvolvimento da Etapa A.

## Próximos Passos
1. Criar a tabela `stripe_plans` para mapear identificadores em `price_ids`.
2. Criar a tabela `stripe_events` para controle de idempotência.
3. Solicitar os segredos do Stripe ao usuário para gravação no backend.
