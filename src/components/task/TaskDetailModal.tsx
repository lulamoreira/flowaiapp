import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, STATUS_CONFIG, PRIORITY_CONFIG, TaskStatus, TaskPriority, Subtask } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { Plus, Trash2, Paperclip, X } from 'lucide-react';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const { state, dispatch } = useAppStore();
  const [newSubtask, setNewSubtask] = useState('');

  if (!task) return null;

  const current = state.tasks.find(t => t.id === task.id) || task;

  const update = (updates: Partial<Task>) => {
    dispatch({ type: 'UPDATE_TASK', payload: { ...current, ...updates } });
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const sub: Subtask = { id: `s${Date.now()}`, title: newSubtask.trim(), completed: false };
    update({ subtasks: [...current.subtasks, sub] });
    setNewSubtask('');
  };

  const toggleSubtask = (id: string) => {
    update({ subtasks: current.subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s) });
  };

  const removeSubtask = (id: string) => {
    update({ subtasks: current.subtasks.filter(s => s.id !== id) });
  };

  const addAttachment = () => {
    const name = `documento-${Date.now()}.pdf`;
    update({ attachments: [...current.attachments, { id: `a${Date.now()}`, name, size: '1.2 MB', addedAt: new Date().toISOString().split('T')[0] }] });
  };

  const assignee = state.users.find(u => u.id === current.assignee);

  return (
    <Dialog open={!!task} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Input
              value={current.title}
              onChange={e => update({ title: e.target.value })}
              className="text-lg font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={current.status} onValueChange={v => update({ status: v as TaskStatus, ...(v === 'done' ? { completedAt: new Date().toISOString().split('T')[0] } : { completedAt: undefined }) })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                        {v.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
              <Select value={current.priority} onValueChange={v => update({ priority: v as TaskPriority })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsável</label>
              <Select value={current.assignee || 'none'} onValueChange={v => update({ assignee: v === 'none' ? '' : v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {state.users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de entrega</label>
              <Input type="date" value={current.dueDate} onChange={e => update({ dueDate: e.target.value })} className="h-9" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
            <Textarea
              value={current.description}
              onChange={e => update({ description: e.target.value })}
              placeholder="Adicionar descrição..."
              rows={3}
            />
          </div>

          {/* Subtasks */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Subtarefas ({current.subtasks.filter(s => s.completed).length}/{current.subtasks.length})
            </label>
            <div className="space-y-1.5">
              {current.subtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 group">
                  <Checkbox checked={sub.completed} onCheckedChange={() => toggleSubtask(sub.id)} />
                  <span className={`text-sm flex-1 ${sub.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {sub.title}
                  </span>
                  <button onClick={() => removeSubtask(sub.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                placeholder="Nova subtarefa..."
                className="h-8 text-sm"
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
              />
              <Button size="sm" variant="ghost" onClick={addSubtask} className="h-8">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Anexos</label>
            <div className="space-y-1.5">
              {current.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 text-sm text-foreground bg-muted/50 rounded px-3 py-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1">{att.name}</span>
                  <span className="text-xs text-muted-foreground">{att.size}</span>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="mt-2 h-8 text-xs" onClick={addAttachment}>
              <Paperclip className="h-3.5 w-3.5 mr-1" />
              Simular anexo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
