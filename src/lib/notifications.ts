import { supabase } from '@/integrations/supabase/client';

export async function createNotification({
  userId,
  title,
  message,
  link,
}: {
  userId: string;
  title: string;
  message: string;
  link?: string;
}) {
  await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    link: link || null,
  });
}
