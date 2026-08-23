import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ProjectMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
}

export function ProjectMembersDialog({ open, onOpenChange, boardId }: ProjectMembersDialogProps) {
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [authorizedIds, setAuthorizedIds] = useState<string[]>([]);
  const [initialAuthorizedIds, setInitialAuthorizedIds] = useState<string[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string; tasks: number; subtasks: number } | null>(null);

  // Load authorized members for this board
  const loadAuthorized = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const { data, error } = await supabase
        .from('project_members' as any)
        .select('user_id')
        .eq('board_id', boardId)
        .abortSignal(controller.signal);
      
      if (error) throw error;
      const ids = (data as any[])?.map((m: any) => m.user_id) || [];
      setAuthorizedIds(ids);
      setInitialAuthorizedIds(ids);
      setFetchError(null);
    } catch (err: any) {
      console.error('Error loading members:', err);
      const msg = err.name === 'AbortError' ? 'Tempo limite de 10s excedido.' : err.message;
      setFetchError(msg);
      toast.error('Erro ao carregar membros: ' + msg);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAuthorized();
    }
  }, [open, boardId]);

  const handleToggle = (userId: string) => {
    setAuthorizedIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleSave = async (userIdsToForceRemove?: string[]) => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const toAdd = authorizedIds.filter(id => !initialAuthorizedIds.includes(id));
      let toRemove = initialAuthorizedIds.filter(id => !authorizedIds.includes(id));
      
      if (userIdsToForceRemove) {
        toRemove = userIdsToForceRemove;
      }

      if (!userIdsToForceRemove && toRemove.length > 0) {
        for (const userId of toRemove) {
          const boardTasks = state.tasks.filter(t => t.boardId === boardId);
          const tasksWithAssignee = boardTasks.filter(t => t.assignee === userId);
          let subtaskCount = 0;
          boardTasks.forEach(t => {
            if (t.subtasks && Array.isArray(t.subtasks)) {
              subtaskCount += t.subtasks.filter((s: any) => s.assignee === userId).length;
            }
          });

          if (tasksWithAssignee.length > 0 || subtaskCount > 0) {
            const user = state.users.find(u => u.id === userId);
            setConfirmRemove({
              userId,
              name: user?.name || 'Usuário',
              tasks: tasksWithAssignee.length,
              subtasks: subtaskCount
            });
            setLoading(false);
            clearTimeout(timeoutId);
            return;
          }
        }
      }

      if (toRemove.length > 0) {
        const boardTasks = state.tasks.filter(t => t.boardId === boardId);
        const affectedTasks = boardTasks.filter(t => {
          const hasAssignee = toRemove.includes(t.assignee);
          const hasSubtaskAssignee = t.subtasks?.some((s: any) => toRemove.includes(s.assignee));
          return hasAssignee || hasSubtaskAssignee;
        });

        if (affectedTasks.length > 0) {
          for (const task of affectedTasks) {
            const updates: any = {};
            if (toRemove.includes(task.assignee)) updates.assignee = null;
            if (task.subtasks) {
              updates.subtasks = task.subtasks.map((s: any) => 
                toRemove.includes(s.assignee) ? { ...s, assignee: undefined } : s
              );
            }
            const { error } = await supabase.from('tasks').update(updates).eq('id', task.id).abortSignal(controller.signal);
            if (error) throw error;
          }
          
          const newTasks = state.tasks.map(t => {
            if (t.boardId !== boardId) return t;
            if (!toRemove.includes(t.assignee) && !t.subtasks?.some((s: any) => toRemove.includes(s.assignee))) return t;
            
            return {
              ...t,
              assignee: toRemove.includes(t.assignee) ? '' : t.assignee,
              subtasks: t.subtasks?.map((s: any) => 
                toRemove.includes(s.assignee) ? { ...s, assignee: undefined } : s
              ) || []
            };
          });
          dispatch({ type: 'SET_STATE', payload: { tasks: newTasks } });
        }

        const { error } = await supabase
          .from('project_members' as any)
          .delete()
          .eq('board_id', boardId)
          .in('user_id', toRemove)
          .abortSignal(controller.signal);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('project_members' as any)
          .insert(toAdd.map(uid => ({ board_id: boardId, user_id: uid })))
          .abortSignal(controller.signal);
        if (error) throw error;
      }

      toast.success('Membros atualizados com sucesso');
      onOpenChange(false);
      setFetchError(null);
    } catch (err: any) {
      console.error('Error saving members:', err);
      const msg = err.name === 'AbortError' ? 'Tempo limite de 10s excedido.' : err.message;
      setFetchError(msg);
      toast.error('Erro ao salvar: ' + msg);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      setConfirmRemove(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Autorização de Acesso ao Projeto
          </DialogTitle>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground mt-2">
          Selecione os colaboradores que têm permissão para visualizar e interagir com este projeto.
        </p>

        <ScrollArea className="h-[300px] mt-4 border rounded-md p-2">
          {loading && !authorizedIds.length ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-sm font-medium text-destructive">{fetchError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => loadAuthorized()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {state.users.map((user) => (
                <div key={user.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer" onClick={() => handleToggle(user.id)}>
                  <Checkbox 
                    id={`user-${user.id}`} 
                    checked={authorizedIds.includes(user.id)}
                    className="pointer-events-none"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{user.email || 'Sem email'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Remover autorização?
              </AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{confirmRemove?.name}</strong> é responsável por {confirmRemove?.tasks} tarefas e {confirmRemove?.subtasks} subtarefas neste projeto. 
                Ao remover a autorização, essas tarefas ficarão SEM responsável e poderão ser reatribuídas. Deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                // Manter diálogo aberto com a pessoa marcada (revertendo o toggle local se necessário)
                setAuthorizedIds(prev => [...prev, confirmRemove!.userId]);
                setConfirmRemove(null);
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleSave()} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={() => handleSave()} disabled={loading} className="bg-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
