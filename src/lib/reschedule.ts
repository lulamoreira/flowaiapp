import { Task } from '@/types';
import {
  addDays,
  differenceInDays,
  differenceInCalendarDays,
  parseISO,
  format,
  addBusinessDays,
  differenceInBusinessDays,
  isWeekend,
  nextMonday,
} from 'date-fns';

export interface RescheduleResult {
  taskId: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  originalStart: string | null;
  originalEnd: string | null;
  diffDays: number;
  /** True quando a tarefa está travada e manteve as datas originais. */
  locked?: boolean;
}

export interface Conflict {
  assignee: string;
  taskA: string;
  taskB: string;
}

export interface RescheduleOptions {
  /** Quando true, o cálculo usa apenas dias úteis (pula sábado e domingo). */
  businessDays?: boolean;
}

/** Normaliza uma data (com ou sem hora) para o início do dia local. */
function dayOnly(value: string | Date): Date {
  const d = typeof value === 'string' ? parseISO(value) : value;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Empurra a data para a próxima segunda-feira caso caia em fim de semana. */
export function toWorkday(date: Date): Date {
  return isWeekend(date) ? nextMonday(date) : date;
}

/**
 * Resolve a data de início a ser usada em modo dias úteis.
 * Retorna também se houve correção, para a interface avisar o usuário.
 */
export function resolveBusinessStart(date: Date): { date: Date; adjusted: boolean } {
  const normalized = dayOnly(date);
  if (isWeekend(normalized)) {
    return { date: nextMonday(normalized), adjusted: true };
  }
  return { date: normalized, adjusted: false };
}

/**
 * Calcula o reagendamento das tarefas com base em uma nova janela de projeto.
 * Escala proporcional aritmética; opcionalmente em dias úteis.
 * Tarefas com scheduleLocked mantêm exatamente as datas originais.
 */
export function calculateReschedule(
  tasks: Task[],
  newStart: Date,
  newEnd: Date,
  options: RescheduleOptions = {}
): RescheduleResult[] {
  const businessDays = options.businessDays === true;

  // 1. Janela atual do projeto — considera TODAS as tarefas com data (inclusive travadas)
  const datedTasks = tasks.filter(t => t.plannedStart && t.plannedEnd);

  if (datedTasks.length === 0) return [];

  const originalStarts = datedTasks.map(t => dayOnly(t.plannedStart!));
  const originalEnds = datedTasks.map(t => dayOnly(t.plannedEnd!));

  const minOriginalStart = new Date(Math.min(...originalStarts.map(d => d.getTime())));
  const maxOriginalEnd = new Date(Math.max(...originalEnds.map(d => d.getTime())));

  const anchor = businessDays
    ? resolveBusinessStart(newStart).date
    : dayOnly(newStart);
  const targetEnd = dayOnly(newEnd);

  const originalDuration = businessDays
    ? differenceInBusinessDays(maxOriginalEnd, minOriginalStart)
    : differenceInDays(maxOriginalEnd, minOriginalStart);
  const newDuration = businessDays
    ? differenceInBusinessDays(targetEnd, anchor)
    : differenceInDays(targetEnd, anchor);

  if (originalDuration === 0) {
    throw new Error('DURATION_ZERO');
  }

  const factor = newDuration / originalDuration;

  const emptyResult = (task: Task): RescheduleResult => ({
    taskId: task.id,
    plannedStart: null,
    plannedEnd: null,
    originalStart: task.plannedStart || null,
    originalEnd: task.plannedEnd || null,
    diffDays: 0,
  });

  return tasks.map(task => {
    if (!task.plannedStart || !task.plannedEnd) {
      return emptyResult(task);
    }

    // Tarefa travada: nunca muda de data
    if (task.scheduleLocked === true) {
      return {
        taskId: task.id,
        plannedStart: task.plannedStart,
        plannedEnd: task.plannedEnd,
        originalStart: task.plannedStart,
        originalEnd: task.plannedEnd,
        diffDays: 0,
        locked: true,
      };
    }

    const tStart = dayOnly(task.plannedStart);
    const tEnd = dayOnly(task.plannedEnd);

    let newTStart: Date;
    let newTEnd: Date;

    if (businessDays) {
      const offset = differenceInBusinessDays(tStart, minOriginalStart);
      const duration = differenceInBusinessDays(tEnd, tStart);

      newTStart = toWorkday(addBusinessDays(anchor, Math.round(offset * factor)));
      newTEnd = toWorkday(addBusinessDays(newTStart, Math.max(0, Math.round(duration * factor))));
    } else {
      const offsetStart = differenceInDays(tStart, minOriginalStart);
      const offsetEnd = differenceInDays(tEnd, minOriginalStart);

      newTStart = addDays(anchor, Math.round(offsetStart * factor));
      newTEnd = addDays(anchor, Math.round(offsetEnd * factor));
    }

    // Garante início <= fim
    if (newTEnd < newTStart) {
      newTEnd = newTStart;
    }

    return {
      taskId: task.id,
      plannedStart: format(newTStart, 'yyyy-MM-dd'),
      plannedEnd: format(newTEnd, 'yyyy-MM-dd'),
      originalStart: task.plannedStart,
      originalEnd: task.plannedEnd,
      // Diferença apenas em dias de calendário, sem componente de hora
      diffDays: differenceInCalendarDays(dayOnly(newTStart), tStart),
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
