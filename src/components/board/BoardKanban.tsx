import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Task, TaskStatus, STATUS_CONFIG } from '@/types';
import { PriorityBadge } from './PriorityBadge';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GripVertical, User, Calendar } from 'lucide-react';

interface BoardKanbanProps {
  boardId: string;
}

const COLUMNS: TaskStatus[] = ['not_started', 'working', 'stuck', 'waiting', 'done'];

export function BoardKanban({ boardId }: BoardKanbanProps) {
  const { state, dispatch } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const tasks = useMemo(
    () => state.tasks.filter(t => t.boardId === boardId),
    [state.tasks, boardId]
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      not_started: [],
      working: [],
      stuck: [],
      waiting: [],
      done: [],
    };
    tasks.forEach(t => map[t.status]?.push(t));
    return map;
  }, [tasks]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedTaskId) return;
    const task = state.tasks.find(t => t.id === draggedTaskId);
    if (task && task.status !== newStatus) {
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          ...task,
          status: newStatus,
          ...(newStatus === 'done' ? { completedAt: new Date().toISOString().split('T')[0] } : {}),
        },
      });
    }
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
      {COLUMNS.map(status => {
        const config = STATUS_CONFIG[status];
        const columnTasks = tasksByStatus[status];
        const isDragOver = dragOverColumn === status;

        return (
          <div
            key={status}
            className={`flex-shrink-0 w-[280px] rounded-xl border transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'
            }`}
            onDragOver={e => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, status)}
          >
            {/* Column header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-sm font-semibold text-foreground">
                  {config.label}
                </span>
                <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2 min-h-[200px]">
              {columnTasks.map(task => {
                const assignee = state.users.find(u => u.id === task.assignee);
                const isDragging = draggedTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={e => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedTask(task)}
                    className={`group rounded-lg border border-border bg-background p-3 cursor-pointer hover:shadow-md transition-all ${
                      isDragging ? 'opacity-40 scale-95' : ''
                    }`}
                    style={{ borderLeftWidth: '3px', borderLeftColor: config.color }}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <PriorityBadge priority={task.priority} />
                          {assignee && (
                            <div className="flex items-center gap-1">
                              <div className="w-5 h-5 rounded-full bg-[hsl(var(--primary))] text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                                {assignee.avatar}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {assignee.name.split(' ')[0]}
                              </span>
                            </div>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(task.dueDate), 'dd MMM', { locale: ptBR })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
