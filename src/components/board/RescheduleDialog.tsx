import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, AlertTriangle, ArrowRight, History, RefreshCcw, Lock, Unlock } from 'lucide-react';
import { format, parseISO, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateReschedule, detectNewConflicts, resolveBusinessStart, RescheduleResult, Conflict } from '@/lib/reschedule';
import { Task, Board } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

interface RescheduleDialogProps {
  board: Board;
  tasks: Task[];
}

interface Snapshot {
  id: string;
  created_at: string;
  payload: any;
}

export function RescheduleDialog({ board, tasks }: RescheduleDialogProps) {
  const { state, dispatch } = useAppStore();
  const [open, setOpen] = useState(false);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [businessDays, setBusinessDays] = useState(false);
  const [preview, setPreview] = useState<RescheduleResult[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState<Snapshot | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Initial calculation of current project window
  const datedTasks = tasks.filter(t => t.plannedStart && t.plannedEnd);
  const originalStarts = datedTasks.map(t => parseISO(t.plannedStart!));
  const originalEnds = datedTasks.map(t => parseISO(t.plannedEnd!));

  const minStart = datedTasks.length > 0 ? new Date(Math.min(...originalStarts.map(d => d.getTime()))) : null;
  const maxEnd = datedTasks.length > 0 ? new Date(Math.max(...originalEnds.map(d => d.getTime()))) : null;

  const assigneeName = (assignee?: string) => {
    if (!assignee) return '-';
    return state.users.find(u => u.id === assignee)?.name || '-';
  };

  // Tarefas travadas que definem os limites atuais do projeto
  const boundaryLockWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (minStart) {
      const t = datedTasks.find(
        t => t.scheduleLocked && parseISO(t.plannedStart!).getTime() === minStart.getTime()
      );
      if (t) warnings.push(`A tarefa "${t.title}" está travada e define o início atual do projeto; o resultado pode não alcançar a data pedida.`);
    }
    if (maxEnd) {
      const t = datedTasks.find(
        t => t.scheduleLocked && parseISO(t.plannedEnd!).getTime() === maxEnd.getTime()
      );
      if (t) warnings.push(`A tarefa "${t.title}" está travada e define o fim atual do projeto; o resultado pode não alcançar a data pedida.`);
    }
    return warnings;
  }, [tasks, minStart?.getTime(), maxEnd?.getTime()]);

  // Aviso de fim de semana no início escolhido (modo dias úteis)
  const weekendAdjustment = useMemo(() => {
    if (!businessDays || !newStart) return null;
    const parsed = parseISO(newStart);
    if (!isWeekend(parsed)) return null;
    return format(resolveBusinessStart(parsed).date, 'dd/MM/yyyy');
  }, [businessDays, newStart]);

  useEffect(() => {
    if (open) {
      fetchLastSnapshot();
      if (minStart && maxEnd) {
        setNewStart(format(minStart, 'yyyy-MM-dd'));
        setNewEnd(format(maxEnd, 'yyyy-MM-dd'));
      }
    }
  }, [open, board.id]);

  const fetchLastSnapshot = async () => {
    const { data, error } = await supabase
      .from('schedule_snapshots')
      .select('*')
      .eq('board_id', board.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      setLastSnapshot(data as any);
    } else {
      setLastSnapshot(null);
    }
  };

  useEffect(() => {
    if (newStart && newEnd && minStart && maxEnd) {
      try {
        const results = calculateReschedule(tasks, parseISO(newStart), parseISO(newEnd), { businessDays });
        setPreview(results);
        setConflicts(detectNewConflicts(tasks, results));
        setError(null);
      } catch (err: any) {
        if (err.message === 'DURATION_ZERO') {
          setError("Não é possível reagendar um projeto cujas tarefas ocupam um único dia.");
        } else {
          setError("Erro ao calcular o reagendamento.");
        }
        setPreview([]);
        setConflicts([]);
      }
    }
  }, [newStart, newEnd, tasks, businessDays]);

  const toggleLock = (taskId: string) => {
    const task = state.tasks.find(t => t.id === taskId) || tasks.find(t => t.id === taskId);
    if (!task) return;
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, scheduleLocked: !task.scheduleLocked } });
  };

  const handleApply = async () => {
    if (!newStart || !newEnd || preview.length === 0) return;

    setIsApplying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Save Snapshot
      const snapshotPayload = tasks.map(t => ({
        id: t.id,
        planned_start: t.plannedStart,
        planned_end: t.plannedEnd
      }));

      const { error: snapshotError } = await supabase
        .from('schedule_snapshots')
        .insert({
          board_id: board.id,
          created_by: user.id,
          payload: snapshotPayload
        });

      if (snapshotError) throw snapshotError;

      // 2. Update Tasks in batches of 500 (tarefas travadas ficam de fora)
      const batchSize = 500;
      const tasksToUpdate = preview.filter(p => p.plannedStart !== null && !p.locked);

      for (let i = 0; i < tasksToUpdate.length; i += batchSize) {
        const batch = tasksToUpdate.slice(i, i + batchSize);

        for (const p of batch) {
          const { error } = await supabase
            .from('tasks')
            .update({
              planned_start: p.plannedStart,
              planned_end: p.plannedEnd
            })
            .eq('id', p.taskId);

          if (error) throw new Error(`Erro na tarefa ${p.taskId}: ${error.message}`);
        }
      }

      // 3. Update Board
      const { error: boardError } = await supabase
        .from('boards')
        .update({
          project_start: newStart,
          project_end: newEnd
        })
        .eq('id', board.id);

      if (boardError) throw boardError;

      // 4. Update local state
      const updatedIds = new Set(tasksToUpdate.map(p => p.taskId));
      const updatedTasks = state.tasks.map(t => {
        if (!updatedIds.has(t.id)) return t;
        const p = tasksToUpdate.find(res => res.taskId === t.id);
        if (p && p.plannedStart) {
          return { ...t, plannedStart: p.plannedStart, plannedEnd: p.plannedEnd };
        }
        return t;
      });

      const updatedBoards = state.boards.map((b: Board) =>
        b.id === board.id ? { ...b, project_start: newStart, project_end: newEnd } : b
      );

      dispatch({
        type: 'SET_STATE',
        payload: {
          tasks: updatedTasks,
          boards: updatedBoards
        }
      });

      toast.success(`${tasksToUpdate.length} tarefas reagendadas com sucesso!`);
      setOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao reagendar projeto");
    } finally {
      setIsApplying(false);
    }
  };

  const handleUndo = async () => {
    if (!lastSnapshot) return;

    setIsApplying(true);
    try {
      const payload = lastSnapshot.payload as { id: string, planned_start: string, planned_end: string }[];

      const batchSize = 500;
      for (let i = 0; i < payload.length; i += batchSize) {
        const batch = payload.slice(i, i + batchSize);
        for (const item of batch) {
          const { error } = await supabase
            .from('tasks')
            .update({
              planned_start: item.planned_start,
              planned_end: item.planned_end
            })
            .eq('id', item.id);

          if (error) throw new Error(`Erro ao restaurar tarefa ${item.id}: ${error.message}`);
        }
      }

      // Refresh local state
      toast.success("Reagendamento desfeito com sucesso!");
      setOpen(false);
      window.location.reload(); // Simplest way to ensure all state is consistent after mass restore
    } catch (err: any) {
      toast.error(err.message || "Erro ao desfazer");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <RefreshCcw className="h-3.5 w-3.5 mr-1" />
          Reagendar Projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[860px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Reagendar Projeto: {board.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Error message for DURATION_ZERO */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Project Window Input */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Novo Início</Label>
              <Input
                type="date"
                value={newStart}
                onChange={e => setNewStart(e.target.value)}
              />
              {minStart && (
                <p className="text-[10px] text-muted-foreground">
                  Atual: {format(minStart, "dd/MM/yyyy")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Novo Fim</Label>
              <Input
                type="date"
                value={newEnd}
                onChange={e => setNewEnd(e.target.value)}
              />
              {maxEnd && (
                <p className="text-[10px] text-muted-foreground">
                  Atual: {format(maxEnd, "dd/MM/yyyy")}
                </p>
              )}
            </div>

            {/* Business days option */}
            <div className="col-span-2 flex items-start gap-2 pt-1">
              <Checkbox
                id="business-days"
                checked={businessDays}
                onCheckedChange={checked => setBusinessDays(checked === true)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="business-days" className="text-xs font-medium cursor-pointer">
                  Respeitar dias úteis (pula sábado e domingo)
                </Label>
                <p className="text-[10px] text-muted-foreground">Feriados não são considerados</p>
              </div>
            </div>
          </div>

          {/* Weekend start adjustment */}
          {weekendAdjustment && (
            <div className="p-3 bg-muted border rounded-md text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              O início cai em fim de semana; será usado {weekendAdjustment}
            </div>
          )}

          {/* Locked boundary warnings */}
          {boundaryLockWarnings.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md space-y-1">
              {boundaryLockWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* New Conflicts Warnings */}
          {conflicts.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-semibold text-sm mb-2">
                <AlertTriangle className="h-4 w-4" />
                Novos Conflitos de Responsáveis
              </div>
              <ul className="text-xs space-y-1 text-amber-700 dark:text-amber-400">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <strong>{assigneeName(c.assignee)}</strong>: "{c.taskA}" e "{c.taskB}" passam a se sobrepor.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Preview do Reagendamento (Proporcional)</Label>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="px-2 py-2 w-8"></th>
                    <th className="px-3 py-2">Tarefa</th>
                    <th className="px-3 py-2">Responsável</th>
                    <th className="px-3 py-2">Datas Atuais</th>
                    <th className="px-3 py-2">Datas Propostas</th>
                    <th className="px-3 py-2">Dif.</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.filter(p => p.plannedStart).map(p => {
                    const task = tasks.find(t => t.id === p.taskId);
                    const locked = p.locked === true;
                    return (
                      <tr key={p.taskId} className="hover:bg-muted/50">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            aria-label={locked ? 'Destravar datas da tarefa' : 'Travar datas da tarefa'}
                            title={locked ? 'Destravar datas da tarefa' : 'Travar datas da tarefa'}
                            onClick={() => toggleLock(p.taskId)}
                            className="p-1 rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {locked
                              ? <Lock className="h-3.5 w-3.5 text-primary" />
                              : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className={cn("px-3 py-2 font-medium max-w-[200px] truncate", locked && "text-muted-foreground")}>{task?.title}</td>
                        <td className="px-3 py-2 text-muted-foreground">{assigneeName(task?.assignee)}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {p.originalStart ? format(parseISO(p.originalStart), 'dd/MM') : '-'}
                          <ArrowRight className="inline h-3 w-3 mx-1" />
                          {p.originalEnd ? format(parseISO(p.originalEnd), 'dd/MM') : '-'}
                        </td>
                        <td className={cn("px-3 py-2 font-medium", locked ? "text-muted-foreground" : "text-primary")}>
                          {p.plannedStart ? format(parseISO(p.plannedStart), 'dd/MM') : '-'}
                          <ArrowRight className="inline h-3 w-3 mx-1" />
                          {p.plannedEnd ? format(parseISO(p.plannedEnd), 'dd/MM') : '-'}
                        </td>
                        {locked ? (
                          <td className="px-3 py-2 font-semibold text-muted-foreground">Travada</td>
                        ) : (
                          <td className={`px-3 py-2 font-semibold ${p.diffDays > 0 ? 'text-green-600' : p.diffDays < 0 ? 'text-red-600' : ''}`}>
                            {p.diffDays > 0 ? `+${p.diffDays}` : p.diffDays}d
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {preview.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground italic">
                        Nenhuma tarefa com data encontrada para reagendamento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
          {lastSnapshot && (
            <div className="mr-auto flex items-center gap-2">
              <div className="text-[10px] text-muted-foreground flex flex-col">
                <span>Último reagendamento:</span>
                <span>{format(parseISO(lastSnapshot.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8"
                onClick={handleUndo}
                disabled={isApplying}
              >
                <History className="h-3.5 w-3.5 mr-1" />
                Desfazer Último
              </Button>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isApplying}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={isApplying || preview.length === 0}
          >
            {isApplying ? 'Processando...' : 'Aplicar Reagendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
