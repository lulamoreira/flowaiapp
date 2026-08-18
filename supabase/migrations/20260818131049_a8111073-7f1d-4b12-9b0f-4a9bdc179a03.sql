-- RLS for stripe_plans
ALTER TABLE public.stripe_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access to stripe_plans"
ON public.stripe_plans
FOR SELECT
TO authenticated
USING (true);

-- RLS for stripe_events (No policies = service_role only)
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Ensure grants
GRANT ALL ON public.stripe_plans TO service_role;
GRANT ALL ON public.stripe_events TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT SELECT ON public.stripe_plans TO authenticated;
