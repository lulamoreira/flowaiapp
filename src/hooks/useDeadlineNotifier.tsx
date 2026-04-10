import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO, startOfDay } from 'date-fns';

/**
 * Checks tasks with approaching deadlines and creates notifications.
 * Runs once per session (or every 30 min).
 */
export function useDeadlineNotifier() {
  const { state } = useAppStore();
  const { user } = useAuth();
  const lastCheck = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      const today = startOfDay(new Date());
      const todayStr = today.toISOString().slice(0, 10);

      // Only check once per day
      if (lastCheck.current === todayStr) return;
      lastCheck.current = todayStr;

      const tasksWithDeadline = state.tasks.filter(
        t => t.plannedEnd && t.status !== 'done'
      );

      for (const task of tasksWithDeadline) {
        const days = differenceInDays(parseISO(task.plannedEnd!), today);

        if (days < 0) {
          // Overdue
          await createIfNotExists(user.id, task.id, 'overdue', {
            title: '⚠️ Tarefa atrasada',
            message: `"${task.title}" está atrasada há ${Math.abs(days)} dia${Math.abs(days) > 1 ? 's' : ''}.`,
            link: `/board/${task.boardId}`,
          });
        } else if (days === 0) {
          await createIfNotExists(user.id, task.id, 'today', {
            title: '⏰ Tarefa vence hoje',
            message: `"${task.title}" vence hoje.`,
            link: `/board/${task.boardId}`,
          });
        } else if (days <= 2) {
          await createIfNotExists(user.id, task.id, 'soon', {
            title: '📅 Prazo próximo',
            message: `"${task.title}" vence em ${days} dia${days > 1 ? 's' : ''}.`,
            link: `/board/${task.boardId}`,
          });
        }
      }
    };

    check();
    const interval = setInterval(check, 30 * 60 * 1000); // every 30 min
    return () => clearInterval(interval);
  }, [user, state.tasks]);
}

async function createIfNotExists(
  userId: string,
  taskId: string,
  type: string,
  notif: { title: string; message: string; link: string }
) {
  const today = new Date().toISOString().slice(0, 10);
  // Check if we already sent this notification today
  const { data } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('title', notif.title)
    .like('message', `%${taskId.slice(0, 8)}%`)
    .gte('created_at', today)
    .limit(1);

  if (data && data.length > 0) return;

  // Include task ID fragment in message for dedup
  await supabase.from('notifications').insert({
    user_id: userId,
    title: notif.title,
    message: `${notif.message} [${taskId.slice(0, 8)}]`,
    link: notif.link,
  });
}
