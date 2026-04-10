import { supabase } from '@/integrations/supabase/client';

export async function logActivity(action: string, details?: Record<string, any>) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('activity_log').insert({
    user_id: user?.id || null,
    action,
    details: details || {},
  });
}
