import { Task, TaskStatus, TaskPriority } from '@/types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { useAppStore } from '@/store/useAppStore';
import { differenceInDays, startOfDay, parseISO } from 'date-fns';
import { formatTaskDate } from '@/lib/dateUtils';
import { GripVertical, AlertTriangle, Clock, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TaskRowProps {
  task: Task;
  groupColor: string;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  /** Habilita a edição do número; recebe apenas inteiros positivos já validados. */
  onNumberCommit?: (value: number) => void;
}

export function TaskRow({ task, groupColor, onClick, draggable, onDragStart, onDragEnd, onDragOver, onDrop, isDragging, onNumberCommit }: TaskRowProps) {
  const [editingNumber, setEditingNumber] = useState(false);
  const [numberDraft, setNumberDraft] = useState('');
  const { state, dispatch } = useAppStore();
  const assignee = state.users.find(u => u.id === task.assignee);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const authorizedIds = state.projectMembers[task.boardId] || [];
  const hasAuthorized = authorizedIds.length > 0;
  
  const filteredUsers = state.users.filter(u => {
    // b) se a tarefa já tiver um responsável que não é membro autorizado, mantenha essa pessoa visível
    if (u.id === task.assignee) return true;
    if (!hasAuthorized) return true;
    return authorizedIds.includes(u.id);
  });

  const updateTask = (updates: Partial<Task>) => {
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, ...updates } });
  };

  return (
    <div
      className={`flex items-center border-b border-border hover:bg-muted/30 cursor-pointer transition-all group ${
        isDragging ? 'opacity-40 scale-[0.98]' : ''
      }`}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="w-7 flex items-center justify-center">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
      </div>
      <div className="w-1 self-stretch" style={{ backgroundColor: groupColor }} />
      <div className="w-12 px-1 shrink-0 flex items-center justify-center">
        {editingNumber ? (
          <input
            type="text"
            inputMode="numeric"
            value={numberDraft}
            autoFocus
            onClick={e => e.stopPropagation()}
            onChange={e => setNumberDraft(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => setEditingNumber(false)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Escape') { setEditingNumber(false); return; }
              if (e.key !== 'Enter') return;
              const parsed = Number(numberDraft);
              if (!Number.isInteger(parsed) || parsed < 1) {
                setEditingNumber(false);
                return;
              }
              setEditingNumber(false);
              if (parsed !== task.taskNumber) onNumberCommit?.(parsed);
            }}
            className="w-10 text-center text-xs bg-background border border-primary rounded px-1 py-0.5 tabular-nums"
            aria-label="Número da tarefa"
          />
        ) : (
          <button
            type="button"
            disabled={!onNumberCommit}
            onClick={e => {
              e.stopPropagation();
              if (!onNumberCommit) return;
              setNumberDraft(task.taskNumber ? String(task.taskNumber) : '');
              setEditingNumber(true);
            }}
            className={cn(
              'text-xs tabular-nums text-muted-foreground rounded px-1 py-0.5 w-full',
              onNumberCommit && 'hover:bg-muted hover:text-foreground'
            )}
            title={onNumberCommit ? 'Clique para editar o número' : undefined}
          >
            {task.taskNumber ?? '—'}
          </button>
        )}
      </div>
      <div className="flex-1 px-3 py-2.5 text-sm font-medium text-foreground min-w-[200px] truncate">
        {task.title}
      </div>
      <div className="w-[140px] px-2 flex justify-center">
        <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1.5 hover:bg-muted/50 rounded px-2 py-1 transition-colors"
              onClick={(e) => { e.stopPropagation(); setAssigneeOpen(true); }}
            >
              {assignee ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-[#0073ea] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {assignee.avatar}
                  </div>
                  <span className="text-xs text-muted-foreground truncate max-w-[70px]">{assignee.name.split(' ')[0]}</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[180px] p-1" align="center" onClick={(e) => e.stopPropagation()}>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs hover:bg-muted/50 transition-colors"
              onClick={(e) => { e.stopPropagation(); updateTask({ assignee: '' }); setAssigneeOpen(false); }}
            >
              <span className="text-muted-foreground">Sem responsável</span>
            </button>
            {!hasAuthorized && (
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border mb-1">
                Nenhum colaborador autorizado neste projeto — autorize em Compartilhar
              </div>
            )}
            {filteredUsers.map(user => {
              const isNotAuthorized = hasAuthorized && !authorizedIds.includes(user.id) && user.id === task.assignee;
              return (
                <button
                  key={user.id}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs hover:bg-muted/50 transition-colors"
                  onClick={(e) => { e.stopPropagation(); updateTask({ assignee: user.id }); setAssigneeOpen(false); }}
                >
                  <div className="w-6 h-6 rounded-full bg-[#0073ea] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {user.avatar}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className={cn("text-foreground truncate w-full text-left", user.isPlaceholder && "italic text-muted-foreground")}>
                      {user.name}
                    </span>
                    {isNotAuthorized && (
                      <span className="text-[9px] text-destructive leading-tight">sem autorização</span>
                    )}
                  </div>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>
      <div className="w-[130px] px-2 flex justify-center">
        <StatusBadge
          status={task.status}
          onChange={(status: TaskStatus) => updateTask({
            status,
            actualEnd: status === 'done' ? new Date().toISOString() : undefined,
          })}
        />
      </div>
      <div className="w-[110px] px-2 flex justify-center">
        <PriorityBadge
          priority={task.priority}
          onChange={(priority: TaskPriority) => updateTask({ priority })}
        />
      </div>
      <div className="w-[150px] px-2 text-xs text-muted-foreground shrink-0">
        {(() => {
          const startStr = task.plannedStart ? formatTaskDate(task.plannedStart) : '—';
          const endStr = task.plannedEnd ? formatTaskDate(task.plannedEnd) : '—';
          
          if (!task.plannedStart && !task.plannedEnd) return '-';

          const days = task.plannedEnd ? differenceInDays(parseISO(task.plannedEnd), startOfDay(new Date())) : null;
          const overdue = days !== null && days < 0 && task.status !== 'done';
          const soon = days !== null && days >= 0 && days <= 2 && task.status !== 'done';

          return (
            <span className={cn(
              "flex items-center gap-1",
              overdue && "text-destructive font-semibold",
              soon && "text-orange-500 font-medium"
            )}>
              {overdue && <AlertTriangle className="h-3 w-3 shrink-0" />}
              {soon && <Clock className="h-3 w-3 shrink-0" />}
              <span className="truncate">{`${startStr} → ${endStr}`}</span>
            </span>
          );
        })()}
      </div>
    </div>
  );
}
