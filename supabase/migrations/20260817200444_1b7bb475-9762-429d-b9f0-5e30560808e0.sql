
-- 1. Create app_settings for the global kill-switch
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_settings (key, value) 
VALUES ('paywall_active', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone authenticated can view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

-- 2. Add 'owner' to app_role enum
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'owner') THEN
    ALTER TYPE public.app_role ADD VALUE 'owner';
  END IF;
END $$;

-- 3. Mark existing users as early adopters in profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_early_adopter BOOLEAN DEFAULT false;
UPDATE public.profiles SET is_early_adopter = true WHERE created_at < now() AND is_early_adopter = false;

-- 4. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan_id TEXT,
    status TEXT CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid')),
    trial_ends_at TIMESTAMPTZ,
    period_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" 
ON public.subscriptions FOR SELECT TO authenticated 
USING (auth.uid() = user_id);

-- 5. Helper function for trial/subscription check
CREATE OR REPLACE FUNCTION public.is_subscribed(u_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- 1. Check if user is Admin or Owner
    SELECT 1 FROM public.user_roles WHERE user_id = u_id AND role::text IN ('admin', 'owner')
    UNION ALL
    -- 2. Check if user is Early Adopter
    SELECT 1 FROM public.profiles WHERE user_id = u_id AND is_early_adopter = true
    UNION ALL
    -- 3. Check if Paywall is OFF
    SELECT 1 FROM public.app_settings WHERE key = 'paywall_active' AND (value->>0)::boolean = false
    UNION ALL
    -- 4. Check active subscription
    SELECT 1 FROM public.subscriptions 
    WHERE user_id = u_id 
      AND (status IN ('active', 'trialing') OR (trial_ends_at IS NOT NULL AND trial_ends_at > now()))
  )
$$;
