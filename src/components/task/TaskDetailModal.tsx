import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Task, STATUS_CONFIG, PRIORITY_CONFIG, TaskStatus, TaskPriority, Subtask, Attachment } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Paperclip, X, Upload, Download } from 'lucide-react';
import { createNotification } from '@/lib/notifications';
import { useAuth } from '@/hooks/useAuth';
import { TaskComments } from '@/components/task/TaskComments';
import { toast } from 'sonner';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const { state, dispatch } = useAppStore();
  const { user } = useAuth();
  const [newSubtask, setNewSubtask] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  if (!task) return null;

  const current = state.tasks.find(t => t.id === task.id) || task;

  const update = (updates: Partial<Task>) => {
    dispatch({ type: 'UPDATE_TASK', payload: { ...current, ...updates } });
  };

  const handleAssigneeChange = (newAssigneeId: string) => {
    const actualId = newAssigneeId === 'none' ? '' : newAssigneeId;
    const previousAssignee = current.assignee;
    update({ assignee: actualId });

    // Notify the new assignee (if different from current user)
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

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of files) {
      const filePath = `${current.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file);

      if (error) {
        toast.error(`Erro ao enviar ${file.name}: ${error.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

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
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const removeAttachment = async (att: Attachment) => {
    if (att.url) {
      // Extract path from URL
      const urlParts = att.url.split('/task-attachments/');
      if (urlParts[1]) {
        await supabase.storage.from('task-attachments').remove([decodeURIComponent(urlParts[1])]);
      }
    }
    update({ attachments: current.attachments.filter(a => a.id !== att.id) });
    toast.success('Anexo removido');
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Fim planejado</label>
              <Input type="datetime-local" value={current.plannedEnd || ''} onChange={e => update({ plannedEnd: e.target.value || undefined })} className="h-9" />
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
            <div className="space-y-2">
              {current.attachments.map(att => {
                const isImage = /\.(jpe?g|png|gif|webp)$/i.test(att.name);
                return (
                  <div key={att.id} className="relative group">
                    {isImage && att.url ? (
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={att.url}
                          alt={att.name}
                          className="w-full max-h-48 object-cover rounded-md border border-border"
                          loading="lazy"
                        />
                      </a>
                    ) : null}
                    <div className="flex items-center gap-2 text-sm text-foreground bg-muted/50 rounded px-3 py-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      {att.url ? (
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex-1 hover:underline text-primary truncate">
                          {att.name}
                        </a>
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
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`mt-2 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                dragging
                  ? 'border-primary bg-primary/10'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {uploading ? 'Enviando...' : dragging ? 'Solte os arquivos aqui' : 'Arraste arquivos aqui ou clique para selecionar'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Comments */}
          <TaskComments taskId={current.id} />

          {/* Close button */}
          <div className="flex justify-end pt-4 border-t border-border mt-4">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
