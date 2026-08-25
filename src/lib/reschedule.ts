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

export interface ScheduleDateUpdate {
  taskId: string;
  plannedStart: string | null;
  plannedEnd: string | null;
}

export interface SmartDateEditResult {
  /** Atualizações finais que devem ser gravadas no banco. */
  updates: ScheduleDateUpdate[];
  /** Estratégia usada para explicar o comportamento na interface. */
  strategy: 'project-window' | 'sequence' | 'single';
  /** True quando a última tarefa estava sem data e recebeu uma sugestão automática. */
  suggestedOpenEnd?: boolean;
}

/** Duração padrão (em dias corridos) usada ao sugerir data para tarefa sem data. */
const DEFAULT_OPEN_TASK_DURATION_DAYS = 1;


/** Normaliza uma data (com ou sem hora) para o início do dia local. */
function dayOnly(value: string | Date): Date {
  const d = typeof value === 'string' ? parseISO(value) : value;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return format(dayOnly(value), 'yyyy-MM-dd');
}

function sameDate(a: string | null | undefined, b: string | null | undefined): boolean {
  return dateKey(a) === dateKey(b);
}

function getDatedBounds(tasks: Task[]): { start: Date; end: Date } | null {
  const dated = tasks.filter(task => task.plannedStart && task.plannedEnd);
  if (dated.length === 0) return null;

  const starts = dated
    .map(task => task.plannedStart)
    .filter((value): value is string => Boolean(value))
    .map(dayOnly);
  const ends = dated
    .map(task => task.plannedEnd)
    .filter((value): value is string => Boolean(value))
    .map(dayOnly);

  return {
    start: new Date(Math.min(...starts.map(date => date.getTime()))),
    end: new Date(Math.max(...ends.map(date => date.getTime()))),
  };
}

function shiftedDate(value: string | null | undefined, deltaDays: number): string | null {
  if (!value) return null;
  return format(addDays(dayOnly(value), deltaDays), 'yyyy-MM-dd');
}

function scheduleChanged(task: Task, update: ScheduleDateUpdate): boolean {
  return !sameDate(task.plannedStart, update.plannedStart) || !sameDate(task.plannedEnd, update.plannedEnd);
}

function daysBetween(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  return Math.max(0, differenceInCalendarDays(dayOnly(end), dayOnly(start)));
}

function writeScheduleUpdate(
  updates: Map<string, ScheduleDateUpdate>,
  task: Task,
  plannedStart: Date,
  plannedEnd: Date
) {
  if (task.scheduleLocked) return;
  updates.set(task.id, {
    taskId: task.id,
    plannedStart: format(plannedStart, 'yyyy-MM-dd'),
    plannedEnd: format(plannedEnd, 'yyyy-MM-dd'),
  });
}

function compareTaskOrder(a: Task, b: Task): number {
  const an = typeof a.taskNumber === 'number' ? a.taskNumber : Number.POSITIVE_INFINITY;
  const bn = typeof b.taskNumber === 'number' ? b.taskNumber : Number.POSITIVE_INFINITY;
  if (an !== bn) return an - bn;
  const ap = typeof a.position === 'number' ? a.position : Number.POSITIVE_INFINITY;
  const bp = typeof b.position === 'number' ? b.position : Number.POSITIVE_INFINITY;
  if (ap !== bp) return ap - bp;
  const ac = a.createdAt || '';
  const bc = b.createdAt || '';
  if (ac !== bc) return ac < bc ? -1 : 1;
  return a.title.localeCompare(b.title, 'pt-BR');
}

/**
 * Mantém coerência contextual da sequência quando existem tarefas travadas.
 *
 * Uma tarefa travada posterior é uma âncora: tarefas anteriores, pela ordem do
 * código, não podem terminar depois do início dela. O inverso também vale para
 * tarefas posteriores, que não podem começar antes do fim da âncora.
 */
function constrainUpdatesByLockedAnchors(
  boardTasks: Task[],
  candidateUpdates: ScheduleDateUpdate[]
): ScheduleDateUpdate[] {
  if (!boardTasks.some(task => task.scheduleLocked && task.plannedStart && task.plannedEnd)) {
    return candidateUpdates;
  }

  const updates = new Map(candidateUpdates.map(update => [update.taskId, update]));
  const effective = boardTasks
    .slice()
    .sort(compareTaskOrder)
    .map(task => {
      const update = updates.get(task.id);
      return {
        task,
        plannedStart: update ? update.plannedStart : task.plannedStart ?? null,
        plannedEnd: update ? update.plannedEnd : task.plannedEnd ?? null,
      };
    });

  effective.forEach((entry, index) => {
    if (!entry.task.scheduleLocked || !entry.plannedStart) return;

    let cursor = addDays(dayOnly(entry.plannedStart), -1);
    for (let i = index - 1; i >= 0; i -= 1) {
      const previous = effective[i];
      if (previous.task.scheduleLocked) break;
      if (!previous.plannedStart || !previous.plannedEnd) continue;

      const currentStart = dayOnly(previous.plannedStart);
      const currentEnd = dayOnly(previous.plannedEnd);
      const duration = daysBetween(previous.plannedStart, previous.plannedEnd);

      if (currentEnd > cursor) {
        const adjustedEnd = cursor;
        const adjustedStart = addDays(adjustedEnd, -duration);
        previous.plannedStart = format(adjustedStart, 'yyyy-MM-dd');
        previous.plannedEnd = format(adjustedEnd, 'yyyy-MM-dd');
        writeScheduleUpdate(updates, previous.task, adjustedStart, adjustedEnd);
        cursor = addDays(adjustedStart, -1);
      } else {
        cursor = addDays(currentStart, -1);
      }
    }
  });

  effective.forEach((entry, index) => {
    if (!entry.task.scheduleLocked || !entry.plannedEnd) return;

    let cursor = addDays(dayOnly(entry.plannedEnd), 1);
    for (let i = index + 1; i < effective.length; i += 1) {
      const next = effective[i];
      if (next.task.scheduleLocked) break;
      if (!next.plannedStart || !next.plannedEnd) continue;

      const currentStart = dayOnly(next.plannedStart);
      const currentEnd = dayOnly(next.plannedEnd);
      const duration = daysBetween(next.plannedStart, next.plannedEnd);

      if (currentStart < cursor) {
        const adjustedStart = cursor;
        const adjustedEnd = addDays(adjustedStart, duration);
        next.plannedStart = format(adjustedStart, 'yyyy-MM-dd');
        next.plannedEnd = format(adjustedEnd, 'yyyy-MM-dd');
        writeScheduleUpdate(updates, next.task, adjustedStart, adjustedEnd);
        cursor = addDays(adjustedEnd, 1);
      } else {
        cursor = addDays(currentEnd, 1);
      }
    }
  });

  return Array.from(updates.values()).filter(update => {
    const original = boardTasks.find(task => task.id === update.taskId);
    if (!original) return false;
    if (original.scheduleLocked) return false;
    return scheduleChanged(original, update);
  });
}

/**
 * True quando a(s) última(s) tarefa(s) do quadro (na ordem do código) estão sem
 * nenhuma data. Nesse caso o projeto tem "fim aberto": atrasos empurram a
 * entrega para frente em vez de comprimir o cronograma existente.
 */
export function hasOpenProjectEnd(tasks: Task[]): boolean {
  const ordered = tasks.slice().sort(compareTaskOrder);
  const last = ordered[ordered.length - 1];
  if (!last) return false;
  return !last.plannedStart && !last.plannedEnd;
}

/**
 * Sugere datas para as tarefas finais sem data, encadeando-as após o término
 * da última tarefa que possui data (já considerando as atualizações aplicadas).
 */
function suggestOpenTailUpdates(
  boardTasks: Task[],
  appliedUpdates: ScheduleDateUpdate[]
): ScheduleDateUpdate[] {
  const byTask = new Map(appliedUpdates.map(update => [update.taskId, update]));
  const effective = boardTasks.map(task => {
    const update = byTask.get(task.id);
    return {
      task,
      plannedStart: update ? update.plannedStart : task.plannedStart ?? null,
      plannedEnd: update ? update.plannedEnd : task.plannedEnd ?? null,
    };
  });
  const ordered = effective.slice().sort((a, b) => compareTaskOrder(a.task, b.task));

  let lastDatedIndex = -1;
  ordered.forEach((entry, index) => {
    if (entry.plannedStart && entry.plannedEnd) lastDatedIndex = index;
  });
  if (lastDatedIndex === -1) return [];

  const tail = ordered.slice(lastDatedIndex + 1);
  if (tail.length === 0) return [];
  // Só sugere quando TODAS as tarefas finais estão realmente sem data.
  if (tail.some(entry => entry.plannedStart || entry.plannedEnd)) return [];

  let cursor = dayOnly(ordered[lastDatedIndex].plannedEnd!);
  const suggestions: ScheduleDateUpdate[] = [];

  for (const entry of tail) {
    if (entry.task.scheduleLocked) continue;
    const start = addDays(cursor, 1);
    const end = addDays(start, Math.max(0, DEFAULT_OPEN_TASK_DURATION_DAYS - 1));
    suggestions.push({
      taskId: entry.task.id,
      plannedStart: format(start, 'yyyy-MM-dd'),
      plannedEnd: format(end, 'yyyy-MM-dd'),
    });
    cursor = end;
  }

  return suggestions;
}


/**
 * Reagendamento inteligente disparado pela edição direta da data de uma tarefa.
 *
 * - Se a edição mexe no início/fim do projeto, reaproveita o cálculo proporcional
 *   do botão "Reagendar Projeto" para redistribuir todo o cronograma.
 * - Se a edição é interna, preserva a tarefa editada exatamente como o usuário
 *   definiu e desloca as tarefas seguintes, na ordem do código da tarefa.
 * - Tarefas travadas só mudam quando são a tarefa editada diretamente.
 */
export function calculateSmartDateEdit(
  tasks: Task[],
  changedTaskId: string,
  changes: Partial<Pick<Task, 'plannedStart' | 'plannedEnd'>>
): SmartDateEditResult {
  const changedTask = tasks.find(task => task.id === changedTaskId);
  if (!changedTask) return { updates: [], strategy: 'single' };

  const nextChangedTask: Task = { ...changedTask, ...changes };
  if (nextChangedTask.plannedStart && nextChangedTask.plannedEnd) {
    const nextStart = dayOnly(nextChangedTask.plannedStart);
    const nextEnd = dayOnly(nextChangedTask.plannedEnd);
    if (nextEnd < nextStart) {
      if (Object.prototype.hasOwnProperty.call(changes, 'plannedStart')) {
        nextChangedTask.plannedEnd = dateKey(nextChangedTask.plannedStart) ?? undefined;
      } else {
        nextChangedTask.plannedStart = dateKey(nextChangedTask.plannedEnd) ?? undefined;
      }
    }
  }
  const boardTasks = tasks.filter(task => task.boardId === changedTask.boardId);
  const nextBoardTasks = boardTasks.map(task => (task.id === changedTaskId ? nextChangedTask : task));

  const startWasEdited = Object.prototype.hasOwnProperty.call(changes, 'plannedStart');
  const endWasEdited = Object.prototype.hasOwnProperty.call(changes, 'plannedEnd');
  const startChanged = startWasEdited && !sameDate(changedTask.plannedStart, nextChangedTask.plannedStart);
  const endChanged = endWasEdited && !sameDate(changedTask.plannedEnd, nextChangedTask.plannedEnd);

  if (!startChanged && !endChanged) {
    return { updates: [], strategy: 'single' };
  }

  const originalBounds = getDatedBounds(boardTasks);
  const nextBounds = getDatedBounds(nextBoardTasks);
  const editedOriginalStart = changedTask.plannedStart ? dayOnly(changedTask.plannedStart) : null;
  const editedOriginalEnd = changedTask.plannedEnd ? dayOnly(changedTask.plannedEnd) : null;

  const touchesProjectStart = Boolean(
    originalBounds &&
    nextBounds &&
    startChanged &&
    editedOriginalStart &&
    editedOriginalStart.getTime() === originalBounds.start.getTime()
  );
  const touchesProjectEnd = Boolean(
    originalBounds &&
    nextBounds &&
    endChanged &&
    editedOriginalEnd &&
    editedOriginalEnd.getTime() === originalBounds.end.getTime()
  );
  const expandsProject = Boolean(
    originalBounds &&
    nextBounds &&
    (nextBounds.start.getTime() !== originalBounds.start.getTime() ||
      nextBounds.end.getTime() !== originalBounds.end.getTime())
  );

  // Fim aberto: a última tarefa está sem data, então o projeto não tem prazo
  // fixo. Nesse caso nunca comprimimos o cronograma — o atraso é propagado para
  // frente e a entrega final é sugerida adiante.
  const openProjectEnd = hasOpenProjectEnd(boardTasks);

  if (!openProjectEnd && originalBounds && nextBounds && (touchesProjectStart || touchesProjectEnd || expandsProject)) {
    try {
      const proportional = calculateReschedule(boardTasks, nextBounds.start, nextBounds.end);
      const proportionalUpdates = proportional
        .filter(result => result.plannedStart !== null && result.plannedEnd !== null && !result.locked)
        .map(result => ({
          taskId: result.taskId,
          plannedStart: result.plannedStart,
          plannedEnd: result.plannedEnd,
        }));

      const forcedEditedUpdate: ScheduleDateUpdate = {
        taskId: changedTaskId,
        plannedStart: dateKey(nextChangedTask.plannedStart),
        plannedEnd: dateKey(nextChangedTask.plannedEnd),
      };
      const byTask = new Map(proportionalUpdates.map(update => [update.taskId, update]));
      byTask.set(changedTaskId, forcedEditedUpdate);

      const updates = Array.from(byTask.values()).filter(update => {
        const original = boardTasks.find(task => task.id === update.taskId);
        if (!original) return false;
        if (original.scheduleLocked && original.id !== changedTaskId) return false;
        return scheduleChanged(original, update);
      });

      const constrainedUpdates = constrainUpdatesByLockedAnchors(boardTasks, updates);
      const tail = suggestOpenTailUpdates(boardTasks, constrainedUpdates);
      const allUpdates = [...constrainedUpdates, ...tail];

      return {
        updates: [...constrainedUpdates, ...tail],
        strategy: allUpdates.length > 1 ? 'project-window' : 'single',
        suggestedOpenEnd: tail.length > 0,
      };
    } catch {
      // Se o cronograma não puder ser escalado proporcionalmente, cai para
      // deslocamento sequencial para ainda preservar a intenção do usuário.
    }
  }

  const deltaSource = endChanged
    ? { before: changedTask.plannedEnd, after: nextChangedTask.plannedEnd }
    : { before: changedTask.plannedStart, after: nextChangedTask.plannedStart };
  const beforeDate = deltaSource.before ? dayOnly(deltaSource.before) : null;
  const afterDate = deltaSource.after ? dayOnly(deltaSource.after) : null;
  const deltaDays = beforeDate && afterDate ? differenceInCalendarDays(afterDate, beforeDate) : 0;
  const ordered = boardTasks.slice().sort(compareTaskOrder);
  const changedIndex = ordered.findIndex(task => task.id === changedTaskId);

  const updates: ScheduleDateUpdate[] = [
    {
      taskId: changedTaskId,
      plannedStart: dateKey(nextChangedTask.plannedStart),
      plannedEnd: dateKey(nextChangedTask.plannedEnd),
    },
  ];

  if (changedIndex !== -1 && deltaDays !== 0) {
    ordered.slice(changedIndex + 1).forEach(task => {
      if (task.scheduleLocked || !task.plannedStart || !task.plannedEnd) return;
      updates.push({
        taskId: task.id,
        plannedStart: shiftedDate(task.plannedStart, deltaDays),
        plannedEnd: shiftedDate(task.plannedEnd, deltaDays),
      });
    });
  }

  const filteredUpdates = updates.filter(update => {
    const original = boardTasks.find(task => task.id === update.taskId);
    if (!original) return false;
    // Travadas só mudam quando são exatamente a tarefa editada pelo usuário.
    if (original.scheduleLocked && original.id !== changedTaskId) return false;
    return scheduleChanged(original, update);
  });

  const constrainedUpdates = constrainUpdatesByLockedAnchors(boardTasks, filteredUpdates);
  const tailUpdates = suggestOpenTailUpdates(boardTasks, constrainedUpdates);
  const allUpdates = [...constrainedUpdates, ...tailUpdates];

  return {
    updates: allUpdates,
    strategy: allUpdates.length > 1 ? 'sequence' : 'single',
    suggestedOpenEnd: tailUpdates.length > 0,
  };
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
