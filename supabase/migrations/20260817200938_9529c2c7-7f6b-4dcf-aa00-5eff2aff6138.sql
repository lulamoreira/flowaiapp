
-- Test A: paywall_active = false
UPDATE public.app_settings SET value = 'false'::jsonb WHERE key = 'paywall_active';
-- No SELECT here, will do in separate read calls to respect tool constraints if needed, 
-- but migrations usually allow DML. 
