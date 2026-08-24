import { Task, TaskGroup } from '@/types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Numeração de tarefas por quadro (public.tasks.task_number).
 *
 * Invariantes que este módulo mantém:
 * - números são inteiros positivos, únicos dentro de um mesmo board_id;
 * - após um reordenamento ou renumeração, a sequência vai de 1 a N, sem buracos;
 * - a exclusão de tarefa NÃO renumera (isso é ação explícita do usuário).
 */

export interface TaskNumberUpdate {
  id: string;
  taskNumber: number;
  /** Só é enviado quando a tarefa também trocou de grupo. */
  groupId?: string;
}

/** Ordena por número; tarefas sem número vão para o fim (desempate por criação/título). */
export function compareByTaskNumber(a: Task, b: Task): number {
  const na = typeof a.taskNumber === 'number' ? a.taskNumber : Number.POSITIVE_INFINITY;
  const nb = typeof b.taskNumber === 'number' ? b.taskNumber : Number.POSITIVE_INFINITY;
  if (na !== nb) return na - nb;
  const ca = a.createdAt || '';
  const cb = b.createdAt || '';
  if (ca !== cb) return ca < cb ? -1 : 1;
  return a.title.localeCompare(b.title, 'pt-BR');
}

/** Próximo número livre do quadro: maior atual + 1 (ou 1 se o quadro está vazio). */
export function nextTaskNumber(tasks: Task[], boardId: string): number {
  let max = 0;
  for (const t of tasks) {
    if (t.boardId !== boardId) continue;
    if (typeof t.taskNumber === 'number' && t.taskNumber > max) max = t.taskNumber;
  }
  return max + 1;
}

/**
 * Ordem "atual" do quadro: grupos na ordem exibida e, dentro de cada grupo,
 * as tarefas por número crescente.
 */
export function buildBoardOrder(tasks: Task[], groups: TaskGroup[], boardId: string): Task[] {
  const groupIndex = new Map<string, number>();
  groups
    .filter(g => g.boardId === boardId)
    .forEach((g, i) => groupIndex.set(g.id, i));

  return tasks
    .filter(t => t.boardId === boardId)
    .slice()
    .sort((a, b) => {
      const ia = groupIndex.has(a.groupId) ? groupIndex.get(a.groupId)! : Number.MAX_SAFE_INTEGER;
      const ib = groupIndex.has(b.groupId) ? groupIndex.get(b.groupId)! : Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return compareByTaskNumber(a, b);
    });
}

/**
 * Converte uma ordem em atualizações 1..N, devolvendo apenas o que realmente mudou.
 * `groupOverrides` permite gravar também a troca de grupo feita pelo arraste.
 */
export function assignmentsFromOrder(
  ordered: Task[],
  groupOverrides: Record<string, string> = {}
): TaskNumberUpdate[] {
  const updates: TaskNumberUpdate[] = [];
  ordered.forEach((task, index) => {
    const taskNumber = index + 1;
    const newGroupId = groupOverrides[task.id];
    const groupChanged = !!newGroupId && newGroupId !== task.groupId;
    if (task.taskNumber !== taskNumber || groupChanged) {
      updates.push({
        id: task.id,
        taskNumber,
        ...(groupChanged ? { groupId: newGroupId } : {}),
      });
    }
  });
  return updates;
}

/**
 * Move uma tarefa para um número específico deslocando as demais.
 * Não duplica e não deixa buraco: a lista é reconstruída de 1 a N.
 */
export function assignmentsForManualNumber(
  ordered: Task[],
  taskId: string,
  target: number
): TaskNumberUpdate[] {
  if (!Number.isInteger(target) || target < 1) return [];
  const current = ordered.findIndex(t => t.id === taskId);
  if (current === -1) return [];

  const without = ordered.filter(t => t.id !== taskId);
  const insertAt = Math.min(Math.max(target - 1, 0), without.length);
  without.splice(insertAt, 0, ordered[current]);
  return assignmentsFromOrder(without);
}

/**
 * Grava as atualizações uma a uma, parando no primeiro erro.
 * Devolve o erro para que a interface avise o usuário e não siga em frente.
 */
export async function persistTaskNumbers(
  updates: TaskNumberUpdate[]
): Promise<{ error: string | null }> {
  for (const u of updates) {
    const payload: Record<string, unknown> = { task_number: u.taskNumber };
    if (u.groupId) payload.group_id = u.groupId;
    const { error } = await supabase.from('tasks').update(payload as any).eq('id', u.id);
    if (error) return { error: error.message };
  }
  return { error: null };
}

/** Aplica as atualizações sobre a lista completa de tarefas (para um único SET_STATE). */
export function applyTaskNumbers(allTasks: Task[], updates: TaskNumberUpdate[]): Task[] {
  if (!updates.length) return allTasks;
  const map = new Map(updates.map(u => [u.id, u]));
  return allTasks.map(t => {
    const u = map.get(t.id);
    if (!u) return t;
    return { ...t, taskNumber: u.taskNumber, groupId: u.groupId ?? t.groupId };
  });
}
