import { Task, TaskStatus, TaskPriority } from '@/types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { useAppStore } from '@/store/useAppStore';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  isDragging?: boolean;
}

export function TaskRow({ task, groupColor, onClick, draggable, onDragStart, onDragEnd, isDragging }: TaskRowProps) {
  const { state, dispatch } = useAppStore();
  const assignee = state.users.find(u => u.id === task.assignee);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

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
    >
      <div className="w-7 flex items-center justify-center">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
      </div>
      <div className="w-1 self-stretch" style={{ backgroundColor: groupColor }} />
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
            {state.users.map(user => (
              <button
                key={user.id}
                className="w-full flex items-center gap-2 px-3 py-2 rounded text-xs hover:bg-muted/50 transition-colors"
                onClick={(e) => { e.stopPropagation(); updateTask({ assignee: user.id }); setAssigneeOpen(false); }}
              >
                <div className="w-6 h-6 rounded-full bg-[#0073ea] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {user.avatar}
                </div>
                <span className={cn("text-foreground", user.isPlaceholder && "italic text-muted-foreground")}>
                  {user.name}
                </span>
              </button>
            ))}
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
      <div className="w-[100px] px-2 text-xs text-muted-foreground">
        {task.plannedEnd ? (() => {
          const days = differenceInDays(parseISO(task.plannedEnd), startOfDay(new Date()));
          const overdue = days < 0 && task.status !== 'done';
          const soon = days >= 0 && days <= 2 && task.status !== 'done';
          return (
            <span className={`flex items-center gap-1 ${overdue ? 'text-destructive font-semibold' : soon ? 'text-orange-500 font-medium' : ''}`}>
              {overdue && <AlertTriangle className="h-3 w-3" />}
              {soon && <Clock className="h-3 w-3" />}
              {format(parseISO(task.plannedEnd), 'dd MMM', { locale: ptBR })}
            </span>
          );
        })() : '-'}
      </div>
    </div>
  );
}
