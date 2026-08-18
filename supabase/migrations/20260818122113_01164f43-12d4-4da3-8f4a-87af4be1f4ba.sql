
-- Tabela para mapear planos internos para IDs de preço do Stripe
CREATE TABLE IF NOT EXISTS public.stripe_plans (
    id TEXT PRIMARY KEY, -- ex: 'basic', 'pro'
    stripe_price_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'brl',
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.stripe_plans TO authenticated;
GRANT ALL ON public.stripe_plans TO service_role;

-- Tabela para controle de idempotência e log de eventos processados do Stripe
CREATE TABLE IF NOT EXISTS public.stripe_events (
    id TEXT PRIMARY KEY, -- stripe event id
    type TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON public.stripe_events TO service_role;
-- Ninguém mais precisa ver isso no frontend

-- Inserir planos iniciais de exemplo (devem ser trocados pelos reais do usuário depois)
INSERT INTO public.stripe_plans (id, stripe_price_id, amount_cents, currency)
VALUES 
    ('starter', 'price_dummy_starter', 4900, 'brl'),
    ('pro', 'price_dummy_pro', 14900, 'brl')
ON CONFLICT (id) DO NOTHING;
