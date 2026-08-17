Decomponha em domínios: UI | Backend | Segurança | Testes | SEO | Deploy | APIs
Decomponha em domínios: UI | Backend | Segurança | Testes | SEO | Deploy | APIs
Decomponha em domínios: UI | Backend | Segurança | Testes | SEO | Deploy | APIs
# Plano de Limpeza e Início da Etapa A do Stripe

Limparemos os resíduos de testes da fundação e iniciaremos a configuração do Stripe.

## ETAPA 0: Limpeza Obrigatória

### 1. Remoção do Usuário Fantasma
- Criar migração para deletar o usuário `00000000-0000-0000-0000-000000000000` de `auth.users`.
- O `ON DELETE CASCADE` garantirá a remoção em `profiles` e `user_roles`.
- Validar a contagem final de usuários (deve ser 4).

### 2. Restauração do Modelo de IA
- Alterar `supabase/functions/ai-expand-description/index.ts` para usar o modelo `google/gemini-2.5-flash`.
- Fazer o deploy da função e testar a conectividade.

---

## ETAPA A: Stripe - Test vs Live Mode

Nesta etapa, prepararemos o ambiente para a integração financeira.

### Conceitos Fundamentais
- **Test Mode:** Usado durante o desenvolvimento. Permite simular pagamentos com cartões de teste sem cobrança real.
- **Live Mode:** Ambiente de produção com cobranças reais. Requer conta Stripe ativada e verificada.

### Ações Técnicas
1. **Configuração de Secrets:**
   - Adicionaremos as chaves `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` ao backend.
   - Usaremos chaves de teste (`sk_test_...`) para esta fase.
2. **Definição de Produtos e Preços:**
   - Criaremos uma estrutura no banco para espelhar os IDs de produtos/preços do Stripe.
3. **Fluxo de Checkout:**
   - Implementaremos a lógica na Edge Function para criar sessões de checkout seguras.

### Regras de Ouro Mantidas
- **Políticas Restritivas:** Bloqueios via `AS RESTRICTIVE`.
- **Paywall Desligado:** A flag `paywall_active` permanecerá `false`.
- **Privilégios:** Admin, Owner e Early Adopters imunes a bloqueios.
