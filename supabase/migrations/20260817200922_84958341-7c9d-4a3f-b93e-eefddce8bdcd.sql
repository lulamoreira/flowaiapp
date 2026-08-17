
-- 1. Create a dummy test user for verification
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', 'test_non_privileged@example.com', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (user_id, full_name, is_early_adopter)
VALUES ('00000000-0000-0000-0000-000000000000', 'Test User', false)
ON CONFLICT (user_id) DO UPDATE SET is_early_adopter = false;

-- 2. Correct the is_subscribed function to handle JSONB scalar correctly
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
    -- 3. Check if Paywall is OFF (using #>> '{}' to correctly read the scalar boolean)
    SELECT 1 FROM public.app_settings WHERE key = 'paywall_active' AND (value #>> '{}')::boolean = false
    UNION ALL
    -- 4. Check active subscription
    SELECT 1 FROM public.subscriptions 
    WHERE user_id = u_id 
      AND (status IN ('active', 'trialing') OR (trial_ends_at IS NOT NULL AND trial_ends_at > now()))
  )
$$;

-- 3. Assign owner role to lula1973@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::app_role FROM auth.users WHERE email = 'lula1973@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
