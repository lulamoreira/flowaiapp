import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Task, STATUS_CONFIG, PRIORITY_CONFIG, TaskStatus, TaskPriority, Subtask, Attachment } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Paperclip, X, Upload, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { createNotification } from '@/lib/notifications';
import { useAuth } from '@/hooks/useAuth';
import { TaskComments } from '@/components/task/TaskComments';
import { TaskTimeTracking } from '@/components/task/TaskTimeTracking';
import { toast } from 'sonner';
import { parseISO, format, isValid, startOfDay } from 'date-fns';
import { debounce } from 'lodash';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function toInputFormat(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return '';
    return format(date, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const { state, dispatch } = useAppStore();
  const { user } = useAuth();
  const [newSubtask, setNewSubtask] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [expandingDesc, setExpandingDesc] = useState(false);
  const [showSubtaskDetails, setShowSubtaskDetails] = useState<Record<string, boolean>>({});
  
  // Local state for debounced fields
  const [localTitle, setLocalTitle] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localPlannedStart, setLocalPlannedStart] = useState('');
  const [localPlannedEnd, setLocalPlannedEnd] = useState('');
  const [localActualStart, setLocalActualStart] = useState('');
  const [localActualEnd, setLocalActualEnd] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const current = task ? (state.tasks.find(t => t.id === task.id) || task) : null;


  // Sync local state when task changes (only once per task open/re-open or store sync)
  useEffect(() => {
    if (!current) return;
    setLocalTitle(current.title || '');
    setLocalDescription(current.description || '');
    setLocalPlannedStart(toInputFormat(current.plannedStart));
    setLocalPlannedEnd(toInputFormat(current.plannedEnd));
    setLocalActualStart(toInputFormat(current.actualStart));
    setLocalActualEnd(toInputFormat(current.actualEnd));
  }, [current?.id]); // We intentionally only sync on ID change to avoid losing focus while typing


  const update = (updates: Partial<Task>) => {
    dispatch({ type: 'UPDATE_TASK', payload: { ...current, ...updates } });
  };

  const debouncedUpdate = useCallback(
    debounce((updates: Partial<Task>) => {
      update(updates);
    }, 800),
    [current.id]
  );

  const handleAssigneeChange = (newAssigneeId: string) => {
    const actualId = newAssigneeId === 'none' ? '' : newAssigneeId;
    const previousAssignee = current.assignee;
    update({ assignee: actualId });

    if (actualId && actualId !== previousAssignee && actualId !== user?.id) {
      const board = state.boards.find(b => b.id === current.boardId);
      const assignerName = state.users.find(u => u.id === user?.id)?.name || 'Alguém';
      createNotification({
        userId: actualId,
        title: '👤 Tarefa atribuída a você',
        message: `${assignerName} atribuiu "${current.title}" a você no quadro ${board?.title || ''}.`,
        link: `/board/${current.boardId}`,
      });
    }
  };

  // Enhanced subtask with assignee, due date, status
  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    const sub: Subtask & { assignee?: string; dueDate?: string; status?: string } = {
      id: `s${Date.now()}`,
      title: newSubtask.trim(),
      completed: false,
    };
    update({ subtasks: [...current.subtasks, sub] });
    setNewSubtask('');
  };

  const toggleSubtask = (id: string) => {
    update({
      subtasks: current.subtasks.map(s =>
        s.id === id ? { ...s, completed: !s.completed } : s
      ),
    });
  };

  const updateSubtask = (id: string, updates: Partial<Subtask & { assignee?: string; dueDate?: string; status?: string }>) => {
    update({
      subtasks: current.subtasks.map(s =>
        s.id === id ? { ...s, ...updates } : s
      ),
    });
  };

  const removeSubtask = (id: string) => {
    update({ subtasks: current.subtasks.filter(s => s.id !== id) });
  };

  const completedSubtasks = current.subtasks.filter(s => s.completed).length;
  const subtaskProgress = current.subtasks.length > 0 ? (completedSubtasks / current.subtasks.length) * 100 : 0;

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      const filePath = `${current.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('task-attachments').upload(filePath, file);
      if (error) { toast.error(`Erro ao enviar ${file.name}: ${error.message}`); continue; }
      const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
      newAttachments.push({
        id: `a${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: file.name,
        size: formatFileSize(file.size),
        addedAt: new Date().toISOString().split('T')[0],
        url: urlData.publicUrl,
      });
    }

    if (newAttachments.length > 0) {
      update({ attachments: [...current.attachments, ...newAttachments] });
      toast.success(`${newAttachments.length} arquivo(s) enviado(s)`);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(Array.from(files));
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    await uploadFiles(Array.from(e.dataTransfer.files));
  };

  const removeAttachment = async (att: Attachment) => {
    if (att.url) {
      const urlParts = att.url.split('/task-attachments/');
      if (urlParts[1]) await supabase.storage.from('task-attachments').remove([decodeURIComponent(urlParts[1])]);
    }
    update({ attachments: current.attachments.filter(a => a.id !== att.id) });
    toast.success('Anexo removido');
  };

  // AI expand description
  const handleExpandWithAI = async () => {
    if (!current.title) return;
    setExpandingDesc(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-expand-description', {
        body: { title: current.title, description: current.description },
      });
      if (data?.expanded) {
        update({ description: data.expanded });
        toast.success('Descrição expandida com IA');
      } else {
        toast.error('Não foi possível expandir a descrição');
      }
    } catch {
      toast.error('Erro ao conectar com IA');
    }
    setExpandingDesc(false);
  };

  return (
    <Dialog open={!!task} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            <Input
              value={localTitle}
              onChange={e => {
                setLocalTitle(e.target.value);
                debouncedUpdate({ title: e.target.value });
              }}
              onBlur={() => {
                debouncedUpdate.cancel();
                if (localTitle !== current.title) update({ title: localTitle });
              }}
              className="text-lg font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={current.status} onValueChange={v => update({ status: v as TaskStatus })}>
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

          {/* Assignee */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Responsável</label>
            <Select value={current.assignee || 'none'} onValueChange={handleAssigneeChange}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {state.users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Início planejado</label>
              <Input 
                type="datetime-local" 
                value={localPlannedStart} 
                onChange={e => {
                  setLocalPlannedStart(e.target.value);
                  debouncedUpdate({ plannedStart: e.target.value || null });
                }} 
                onBlur={() => {
                  debouncedUpdate.cancel();
                  if (localPlannedStart !== toInputFormat(current.plannedStart)) update({ plannedStart: localPlannedStart || null });
                }}
                className="h-9" 
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim planejado</label>
              <Input 
                type="datetime-local" 
                value={localPlannedEnd} 
                onChange={e => {
                  setLocalPlannedEnd(e.target.value);
                  debouncedUpdate({ plannedEnd: e.target.value || null });
                }}
                onBlur={() => {
                  debouncedUpdate.cancel();
                  if (localPlannedEnd !== toInputFormat(current.plannedEnd)) update({ plannedEnd: localPlannedEnd || null });
                }}
                className="h-9" 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Início real</label>
              <Input 
                type="datetime-local" 
                value={localActualStart} 
                onChange={e => {
                  setLocalActualStart(e.target.value);
                  debouncedUpdate({ actualStart: e.target.value || null });
                }}
                onBlur={() => {
                  debouncedUpdate.cancel();
                  if (localActualStart !== toInputFormat(current.actualStart)) update({ actualStart: localActualStart || null });
                }}
                className="h-9" 
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim real</label>
              <Input 
                type="datetime-local" 
                value={localActualEnd} 
                onChange={e => {
                  setLocalActualEnd(e.target.value);
                  debouncedUpdate({ actualEnd: e.target.value || null });
                }}
                onBlur={() => {
                  debouncedUpdate.cancel();
                  if (localActualEnd !== toInputFormat(current.actualEnd)) update({ actualEnd: localActualEnd || null });
                }}
                className="h-9" 
              />
            </div>
          </div>

          {/* Description with AI expand */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={handleExpandWithAI}
                disabled={expandingDesc}
              >
                <Sparkles className="h-3 w-3" />
                {expandingDesc ? 'Expandindo...' : 'Expandir com IA'}
              </Button>
            </div>
            <Textarea
              value={localDescription}
              onChange={e => {
                setLocalDescription(e.target.value);
                debouncedUpdate({ description: e.target.value });
              }}
              onBlur={() => {
                debouncedUpdate.cancel();
                if (localDescription !== current.description) update({ description: localDescription });
              }}
              placeholder="Adicionar descrição..."
              rows={3}
            />
          </div>

          {/* Subtasks with hierarchy */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Subtarefas ({completedSubtasks}/{current.subtasks.length})
            </label>
            {current.subtasks.length > 0 && (
              <Progress value={subtaskProgress} className="h-1.5 mb-2" />
            )}
            <div className="space-y-1">
              {current.subtasks.map((sub: any) => (
                <div key={sub.id} className="group">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowSubtaskDetails(prev => ({ ...prev, [sub.id]: !prev[sub.id] }))} className="text-muted-foreground">
                      {showSubtaskDetails[sub.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    <Checkbox checked={sub.completed} onCheckedChange={() => toggleSubtask(sub.id)} />
                    <span className={`text-sm flex-1 ${sub.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {sub.title}
                    </span>
                    {sub.assignee && (
                      <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                        {state.users.find(u => u.id === sub.assignee)?.name?.split(' ')[0] || ''}
                      </span>
                    )}
                    {sub.dueDate && (
                      <span className="text-[10px] text-muted-foreground">{sub.dueDate?.substring(0, 10)}</span>
                    )}
                    <button onClick={() => removeSubtask(sub.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {showSubtaskDetails[sub.id] && (
                    <div className="ml-8 mt-1 mb-2 grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Responsável</label>
                        <Select value={sub.assignee || 'none'} onValueChange={v => updateSubtask(sub.id, { assignee: v === 'none' ? undefined : v })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Entrega</label>
                        <Input type="date" value={sub.dueDate || ''} onChange={e => updateSubtask(sub.id, { dueDate: e.target.value || undefined })} className="h-7 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Status</label>
                        <Select value={sub.status || 'pending'} onValueChange={v => updateSubtask(sub.id, { status: v, completed: v === 'done' })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="working">Trabalhando</SelectItem>
                            <SelectItem value="done">Concluído</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
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
            <div className="space-y-2">
              {current.attachments.map(att => {
                const isImage = /\.(jpe?g|png|gif|webp)$/i.test(att.name);
                return (
                  <div key={att.id} className="relative group">
                    {isImage && att.url && (
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={att.url} alt={att.name} className="w-full max-h-48 object-cover rounded-md border border-border" loading="lazy" />
                      </a>
                    )}
                    <div className="flex items-center gap-2 text-sm text-foreground bg-muted/50 rounded px-3 py-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      {att.url ? (
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 hover:underline text-primary truncate">{att.name}</a>
                      ) : (
                        <span className="flex-1 truncate">{att.name}</span>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">{att.size}</span>
                      <button onClick={() => removeAttachment(att)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragging(false); }}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'}`}
            >
              <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {uploading ? 'Enviando...' : dragging ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para selecionar'}
              </p>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          </div>

          {/* Time Tracking */}
          <TaskTimeTracking taskId={current.id} />

          {/* Comments */}
          <TaskComments taskId={current.id} />

          {/* Close */}
          <div className="flex justify-end pt-4 border-t border-border mt-4">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
