import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types';
import { ScheduleDateUpdate } from '@/lib/reschedule';

export function applyScheduleDateUpdates(tasks: Task[], updates: ScheduleDateUpdate[]): Task[] {
  if (updates.length === 0) return tasks;
  const byTaskId = new Map(updates.map(update => [update.taskId, update]));
  return tasks.map(task => {
    const update = byTaskId.get(task.id);
    if (!update) return task;
    return {
      ...task,
      plannedStart: update.plannedStart,
      plannedEnd: update.plannedEnd,
    };
  });
}

export async function persistScheduleDateUpdates(updates: ScheduleDateUpdate[]): Promise<{ error: string | null }> {
  for (const update of updates) {
    const { error } = await supabase
      .from('tasks')
      .update({
        planned_start: update.plannedStart,
        planned_end: update.plannedEnd,
      })
      .eq('id', update.taskId);

    if (error) return { error: error.message };
  }

  return { error: null };
}

export async function saveScheduleSnapshot(boardId: string, tasks: Task[]): Promise<{ error: string | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) return { error: authError.message };
  if (!authData.user) return { error: 'Usuário não autenticado.' };

  const payload = tasks
    .filter(task => task.boardId === boardId)
    .map(task => ({
      id: task.id,
      planned_start: task.plannedStart,
      planned_end: task.plannedEnd,
    }));

  const { error } = await supabase
    .from('schedule_snapshots')
    .insert({
      board_id: boardId,
      created_by: authData.user.id,
      payload,
    });

  return { error: error ? error.message : null };
}