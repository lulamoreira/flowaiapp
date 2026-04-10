import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Task, TaskStatus, STATUS_CONFIG } from '@/types';
import { PriorityBadge } from './PriorityBadge';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';
import { SearchFilterBar } from './SearchFilterBar';
import { format, parseISO, isToday, isPast, isThisWeek, addWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GripVertical, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface BoardKanbanProps {
  boardId: string;
}

const COLUMNS: TaskStatus[] = ['not_started', 'working', 'stuck', 'waiting', 'done'];

export function BoardKanban({ boardId }: BoardKanbanProps) {
  const { state, dispatch } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ status: TaskStatus; index: number } | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState('all');

  const allTasks = useMemo(
    () => state.tasks.filter(t => t.boardId === boardId),
    [state.tasks, boardId]
  );

  const tasks = useMemo(() => {
    return allTasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (assigneeFilter !== 'all' && t.assignee !== assigneeFilter) return false;
      if (dueDateFilter !== 'all') {
        const dd = t.plannedEnd ? t.plannedEnd.substring(0, 10) : '';
        if (dueDateFilter === 'no_date' && dd) return false;
        if (dueDateFilter === 'no_date' && !dd) return true;
        if (!dd) return false;
        const d = parseISO(dd);
        if (dueDateFilter === 'overdue' && !isPast(d)) return false;
        if (dueDateFilter === 'today' && !isToday(d)) return false;
        if (dueDateFilter === 'this_week' && !isThisWeek(d, { locale: ptBR })) return false;
        if (dueDateFilter === 'next_week') {
          const nextStart = startOfWeek(addWeeks(new Date(), 1), { locale: ptBR });
          const nextEnd = endOfWeek(addWeeks(new Date(), 1), { locale: ptBR });
          if (d < nextStart || d > nextEnd) return false;
        }
      }
      return true;
    });
  }, [allTasks, search, statusFilter, priorityFilter, assigneeFilter, dueDateFilter]);

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      not_started: [],
      working: [],
      stuck: [],
      waiting: [],
      done: [],
    };
    tasks.forEach(t => map[t.status]?.push(t));
    // Sort by position within each column
    for (const key of Object.keys(map) as TaskStatus[]) {
      map[key].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }
    return map;
  }, [tasks]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverCard = (e: React.DragEvent, status: TaskStatus, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
    setDropIndicator({ status, index });
  };

  const handleDragOverColumn = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
    // If dragging over empty area, set indicator at end
    if (!dropIndicator || dropIndicator.status !== status) {
      setDropIndicator({ status, index: tasksByStatus[status].length });
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
    setDropIndicator(null);
  };

  const handleDrop = useCallback((e: React.DragEvent, newStatus: TaskStatus, dropIndex?: number) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDropIndicator(null);
    if (!draggedTaskId) return;

    const task = state.tasks.find(t => t.id === draggedTaskId);
    if (!task) return;

    const targetTasks = [...tasksByStatus[newStatus]].filter(t => t.id !== draggedTaskId);
    const insertAt = dropIndex ?? targetTasks.length;

    // Recalculate positions
    targetTasks.splice(insertAt, 0, { ...task, status: newStatus });
    const updates = targetTasks.map((t, i) => ({
      ...t,
      position: i,
      status: newStatus,
      ...(t.id === draggedTaskId && newStatus === 'done' ? { completedAt: new Date().toISOString().split('T')[0] } : {}),
    }));

    // Dispatch all updates
    for (const u of updates) {
      dispatch({ type: 'UPDATE_TASK', payload: u });
    }

    // If task moved from another column, also update positions in old column
    if (task.status !== newStatus) {
      const oldColumnTasks = tasksByStatus[task.status].filter(t => t.id !== draggedTaskId);
      oldColumnTasks.forEach((t, i) => {
        if (t.position !== i) {
          dispatch({ type: 'UPDATE_TASK', payload: { ...t, position: i } });
        }
      });
    }

    setDraggedTaskId(null);
  }, [draggedTaskId, state.tasks, tasksByStatus, dispatch]);

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
    setDropIndicator(null);
  };

  const DropLine = () => (
    <div className="h-1 bg-primary rounded-full mx-1 my-0.5 transition-all" />
  );

  return (
    <div className="space-y-4">
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeChange={setAssigneeFilter}
        dueDateFilter={dueDateFilter}
        onDueDateChange={setDueDateFilter}
        users={state.users}
      />
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
            onDragOver={e => handleDragOverColumn(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, status, dropIndicator?.status === status ? dropIndicator.index : columnTasks.length)}
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
            <div className="p-2 space-y-0 min-h-[200px]">
              {columnTasks.map((task, index) => {
                const assignee = state.users.find(u => u.id === task.assignee);
                const isDragging = draggedTaskId === task.id;
                const showIndicatorBefore = dropIndicator?.status === status && dropIndicator.index === index && draggedTaskId !== task.id;

                return (
                  <div key={task.id}>
                    {showIndicatorBefore && <DropLine />}
                    <div
                      draggable
                      onDragStart={e => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        const dropIdx = e.clientY < midY ? index : index + 1;
                        handleDragOverCard(e, status, dropIdx);
                      }}
                      onClick={() => setSelectedTask(task)}
                      className={`group rounded-lg border border-border bg-background p-3 cursor-pointer hover:shadow-md transition-all my-1.5 ${
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
                            {task.plannedEnd && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(task.plannedEnd), 'dd MMM', { locale: ptBR })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Show drop indicator at end */}
              {dropIndicator?.status === status && dropIndicator.index >= columnTasks.length && draggedTaskId && <DropLine />}
            </div>
          </div>
        );
      })}

      <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      </div>
    </div>
  );
}
