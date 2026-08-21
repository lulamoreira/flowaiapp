import { Task } from '@/types';
import { addDays, differenceInDays, parseISO, format } from 'date-fns';

export interface RescheduleResult {
  taskId: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  originalStart: string | null;
  originalEnd: string | null;
  diffDays: number;
}

export interface Conflict {
  assignee: string;
  taskA: string;
  taskB: string;
}

/**
 * Calculates the rescheduling of tasks based on a new project window.
 * Uses arithmetic proportional scaling.
 */
export function calculateReschedule(
  tasks: Task[],
  newStart: Date,
  newEnd: Date
): RescheduleResult[] {
  // 1. Identify current project window from tasks that have dates
  const datedTasks = tasks.filter(t => t.plannedStart && t.plannedEnd);
  
  if (datedTasks.length === 0) return [];

  const originalStarts = datedTasks.map(t => parseISO(t.plannedStart!));
  const originalEnds = datedTasks.map(t => parseISO(t.plannedEnd!));

  const minOriginalStart = new Date(Math.min(...originalStarts.map(d => d.getTime())));
  const maxOriginalEnd = new Date(Math.max(...originalEnds.map(d => d.getTime())));

  const originalDuration = differenceInDays(maxOriginalEnd, minOriginalStart);
  const newDuration = differenceInDays(newEnd, newStart);

  if (originalDuration === 0) {
    throw new Error('DURATION_ZERO');
  }

  const factor = newDuration / originalDuration;

  return tasks.map(task => {
    if (!task.plannedStart || !task.plannedEnd) {
      return {
        taskId: task.id,
        plannedStart: null,
        plannedEnd: null,
        originalStart: task.plannedStart || null,
        originalEnd: task.plannedEnd || null,
        diffDays: 0
      };
    }

    const tStart = parseISO(task.plannedStart);
    const tEnd = parseISO(task.plannedEnd);

    const offsetStart = differenceInDays(tStart, minOriginalStart);
    const offsetEnd = differenceInDays(tEnd, minOriginalStart);

    let newTStart = addDays(newStart, Math.round(offsetStart * factor));
    let newTEnd = addDays(newStart, Math.round(offsetEnd * factor));

    // Ensure start <= end
    if (newTEnd < newTStart) {
      newTEnd = newTStart;
    }

    return {
      taskId: task.id,
      plannedStart: format(newTStart, 'yyyy-MM-dd'),
      plannedEnd: format(newTEnd, 'yyyy-MM-dd'),
      originalStart: task.plannedStart,
      originalEnd: task.plannedEnd,
      diffDays: differenceInDays(newTStart, tStart)
    };
  });
}

/**
 * Detects NEW overlaps for assignees.
 * Compares current conflicts with proposed conflicts.
 */
export function detectNewConflicts(
  tasks: Task[],
  proposed: RescheduleResult[]
): Conflict[] {
  const proposedMap = new Map(proposed.map(p => [p.taskId, p]));
  
  const getConflicts = (taskList: { id: string, assignee: string, start: string | null, end: string | null }[]) => {
    const conflicts = new Set<string>();
    const byAssignee = new Map<string, typeof taskList>();

    taskList.forEach(t => {
      if (!t.assignee || !t.start || !t.end) return;
      if (!byAssignee.has(t.assignee)) byAssignee.set(t.assignee, []);
      byAssignee.get(t.assignee)!.push(t);
    });

    for (const [assignee, userTasks] of byAssignee) {
      for (let i = 0; i < userTasks.length; i++) {
        for (let j = i + 1; j < userTasks.length; j++) {
          const a = userTasks[i];
          const b = userTasks[j];
          
          // Overlap check
          if (a.start! <= b.end! && b.start! <= a.end!) {
            const pair = [a.id, b.id].sort().join(':');
            conflicts.add(`${assignee}|${pair}|${a.id}|${b.id}`);
          }
        }
      }
    }
    return conflicts;
  };

  const currentData = tasks.map(t => ({
    id: t.id,
    assignee: t.assignee,
    start: t.plannedStart || null,
    end: t.plannedEnd || null
  }));

  const proposedData = tasks.map(t => {
    const p = proposedMap.get(t.id);
    return {
      id: t.id,
      assignee: t.assignee,
      start: p?.plannedStart || null,
      end: p?.plannedEnd || null
    };
  });

  const currentConflicts = getConflicts(currentData);
  const proposedConflicts = getConflicts(proposedData);

  const newConflicts: Conflict[] = [];

  for (const c of proposedConflicts) {
    if (!currentConflicts.has(c)) {
      const [assignee, , idA, idB] = c.split('|');
      const taskA = tasks.find(t => t.id === idA)?.title || 'Tarefa A';
      const taskB = tasks.find(t => t.id === idB)?.title || 'Tarefa B';
      newConflicts.push({ assignee, taskA, taskB });
    }
  }

  return newConflicts;
}
