import { useState, useMemo, useCallback, useEffect } from 'react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, parseISO, isWithinInterval, isBefore } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { Task } from '@/types';
import { GroupHeader } from './GroupHeader';
import { TaskRow } from './TaskRow';
import { SearchFilterBar } from './SearchFilterBar';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';
import { toast } from 'sonner';
import { GripVertical, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useScopedTasks } from '@/hooks/useScopedTasks';
import { cn } from '@/lib/utils';

type SortConfig = {
  column: 'item' | 'assignee' | 'status' | 'priority' | 'date' | null;
  direction: 'asc' | 'desc' | null;
};

interface BoardTableProps {
  boardId: string;
}

export function BoardTable({ boardId }: BoardTableProps) {
  const { state, dispatch } = useAppStore();
  const { canEdit, canDelete } = usePermissions();
  const canEditTasks = canEdit('tasks');
  const canDeleteTasks = canDelete('tasks');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  // Column sort state
  const [sort, setSort] = useState<SortConfig>(() => {
    try {
      const saved = localStorage.getItem(`flowai-sort-${boardId}`);
      return saved ? JSON.parse(saved) : { column: null, direction: null };
    } catch (e) {
      return { column: null, direction: null };
    }
  });

  useEffect(() => {
    localStorage.setItem(`flowai-sort-${boardId}`, JSON.stringify(sort));
  }, [sort, boardId]);

  const handleSort = (column: SortConfig['column']) => {
    setSort(prev => {
      if (prev.column === column) {
        if (prev.direction === 'asc') return { column, direction: 'desc' };
        return { column: null, direction: null };
      }
      return { column, direction: 'asc' };
    });
  };

  // Group drag state
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [groupDropIndex, setGroupDropIndex] = useState<number | null>(null);

  const groups = useMemo(
    () => [...state.groups.filter(g => g.boardId === boardId)].sort((a, b) => {
      const posA = typeof (a as any).position === 'number' ? (a as any).position : 0;
      const posB = typeof (b as any).position === 'number' ? (b as any).position : 0;
      return posA - posB;
    }),
    [state.groups, boardId]
  );
  const { filterTasks } = useScopedTasks();
  const allTasks = useMemo(
    () => filterTasks(state.tasks.filter(t => t.boardId === boardId)),
    [state.tasks, boardId, filterTasks]
  );

  const filteredTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const nextWeekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
    const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });

    return allTasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (assigneeFilter !== 'all' && t.assignee !== assigneeFilter) return false;
      if (dueDateFilter !== 'all') {
        const dd = t.plannedEnd ? t.plannedEnd.substring(0, 10) : '';
        if (dueDateFilter === 'no_date') return !dd;
        if (!dd) return false;
        const d = parseISO(dd);
        if (dueDateFilter === 'overdue') return isBefore(d, today) && t.status !== 'done';
        if (dueDateFilter === 'today') return isWithinInterval(d, { start: today, end: todayEnd });
        if (dueDateFilter === 'this_week') return isWithinInterval(d, { start: today, end: weekEnd });
        if (dueDateFilter === 'next_week') return isWithinInterval(d, { start: nextWeekStart, end: nextWeekEnd });
      }
      return true;
    });
  }, [allTasks, search, statusFilter, priorityFilter, assigneeFilter, dueDateFilter]);

  const addTask = (groupId: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: 'Nova tarefa',
      description: '',
      status: 'not_started',
      priority: 'none',
      assignee: '',
      groupId,
      boardId,
      subtasks: [],
      attachments: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    dispatch({ type: 'ADD_TASK', payload: newTask });
    setSelectedTask(newTask);
  };

  // Task drag
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    setDraggedGroupId(null);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTaskId) setDragOverGroupId(groupId);
  };

  const handleDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    setDragOverGroupId(null);
    if (!draggedTaskId) return;
    const task = state.tasks.find(t => t.id === draggedTaskId);
    if (task && task.groupId !== targetGroupId) {
      dispatch({ type: 'UPDATE_TASK', payload: { ...task, groupId: targetGroupId } });
    }
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverGroupId(null);
    setDraggedGroupId(null);
    setGroupDropIndex(null);
  };

  // Group drag
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    e.stopPropagation();
    setDraggedGroupId(groupId);
    setDraggedTaskId(null);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGroupDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!draggedGroupId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setGroupDropIndex(e.clientY < midY ? index : index + 1);
  }, [draggedGroupId]);

  const handleGroupDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedGroupId || groupDropIndex === null) return;

    const currentIndex = groups.findIndex(g => g.id === draggedGroupId);
    if (currentIndex === -1) return;

    const reordered = groups.filter(g => g.id !== draggedGroupId);
    const insertAt = groupDropIndex > currentIndex ? groupDropIndex - 1 : groupDropIndex;
    reordered.splice(insertAt, 0, groups[currentIndex]);

    reordered.forEach((g, i) => {
      dispatch({ type: 'UPDATE_GROUP', payload: { ...g, position: i } as any });
    });

    setDraggedGroupId(null);
    setGroupDropIndex(null);
  }, [draggedGroupId, groupDropIndex, groups, dispatch]);

  const GroupDropLine = () => (
    <div className="h-1 bg-primary rounded-full mx-2 my-0.5 transition-all" />
  );

  const SortIndicator = ({ column }: { column: SortConfig['column'] }) => {
    if (sort.column !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-20 group-hover:opacity-100" />;
    return sort.direction === 'asc' ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

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

      {/* Column headers */}
      <div className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border pb-2 group/header">
        <div className="w-7 shrink-0" />
        <div className="w-1 self-stretch shrink-0" />
        <button 
          onClick={() => handleSort('item')}
          className="flex-1 px-3 min-w-[200px] flex items-center hover:text-foreground transition-colors group"
        >
          Item <SortIndicator column="item" />
        </button>
        <button 
          onClick={() => handleSort('assignee')}
          className="w-[140px] px-2 flex items-center justify-center hover:text-foreground transition-colors group shrink-0"
        >
          Responsável <SortIndicator column="assignee" />
        </button>
        <button 
          onClick={() => handleSort('status')}
          className="w-[130px] px-2 flex items-center justify-center hover:text-foreground transition-colors group shrink-0"
        >
          Status <SortIndicator column="status" />
        </button>
        <button 
          onClick={() => handleSort('priority')}
          className="w-[110px] px-2 flex items-center justify-center hover:text-foreground transition-colors group shrink-0"
        >
          Prioridade <SortIndicator column="priority" />
        </button>
        <button 
          onClick={() => handleSort('date')}
          className="w-[150px] px-2 flex items-center hover:text-foreground transition-colors group shrink-0"
        >
          Data <SortIndicator column="date" />
        </button>
      </div>
      
      {sort.column && (
        <div className="text-[10px] text-muted-foreground italic px-1">
          Ordenado por {sort.column === 'item' ? 'Item' : sort.column === 'assignee' ? 'Responsável' : sort.column === 'status' ? 'Status' : sort.column === 'priority' ? 'Prioridade' : 'Data'} — volte para a ordem manual para reordenar arrastando
        </div>
      )}

      {groups.map((group, index) => {
        const groupTasks = filteredTasks.filter(t => t.groupId === group.id);
        const isDragOver = dragOverGroupId === group.id;
        const isGroupDragging = draggedGroupId === group.id;
        const showDropBefore = draggedGroupId && groupDropIndex === index && draggedGroupId !== group.id;

        return (
          <div key={group.id}>
            {showDropBefore && <GroupDropLine />}
            <div
              className={`rounded-lg border overflow-hidden bg-card transition-all ${
                isDragOver ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              } ${isGroupDragging ? 'opacity-40 scale-[0.98]' : ''}`}
              onDragOver={e => {
                handleDragOver(e, group.id);
                handleGroupDragOver(e, index);
              }}
              onDragLeave={() => setDragOverGroupId(null)}
              onDrop={e => {
                if (draggedGroupId) {
                  handleGroupDrop(e);
                } else {
                  handleDrop(e, group.id);
                }
              }}
            >
              <div className="flex items-center">
                <div
                  draggable={canEditTasks}
                  onDragStart={e => canEditTasks && handleGroupDragStart(e, group.id)}
                  onDragEnd={handleDragEnd}
                  className={`px-1 py-2 rounded-l-lg transition-colors self-stretch flex items-center ${canEditTasks ? 'cursor-grab hover:bg-muted/50' : 'opacity-30'}`}
                  title={canEditTasks ? 'Arrastar para reordenar grupo' : ''}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="flex-1">
                  <GroupHeader
                    group={group}
                    taskCount={groupTasks.length}
                    onToggle={() => dispatch({ type: 'TOGGLE_GROUP', payload: group.id })}
                    onAddTask={canEditTasks ? () => addTask(group.id) : undefined}
                    onRename={canEditTasks ? (title) => { dispatch({ type: 'UPDATE_GROUP', payload: { ...group, title } }); toast.success(`Grupo renomeado para "${title}"`); } : undefined}
                    onDelete={canDeleteTasks ? () => { dispatch({ type: 'DELETE_GROUP', payload: group.id }); toast.success(`Grupo "${group.title}" excluído`); } : undefined}
                  />
                </div>
              </div>
              {!group.collapsed && [...groupTasks].sort((a, b) => {
                if (sort.column && sort.direction) {
                  const dir = sort.direction === 'asc' ? 1 : -1;
                  
                  switch (sort.column) {
                    case 'item':
                      return a.title.localeCompare(b.title, 'pt-BR') * dir;
                    
                    case 'assignee': {
                      const userA = state.users.find(u => u.id === a.assignee)?.name || '';
                      const userB = state.users.find(u => u.id === b.assignee)?.name || '';
                      if (!userA && !userB) return 0;
                      if (!userA) return 1;
                      if (!userB) return -1;
                      return userA.localeCompare(userB, 'pt-BR') * dir;
                    }

                    case 'status': {
                      const statusOrder: Record<string, number> = {
                        'not_started': 0,
                        'working': 1,
                        'stuck': 2,
                        'waiting': 3,
                        'done': 4
                      };
                      const valA = statusOrder[a.status] ?? 99;
                      const valB = statusOrder[b.status] ?? 99;
                      return (valA - valB) * dir;
                    }

                    case 'priority': {
                      const priorityOrder: Record<string, number> = {
                        'critical': 0,
                        'high': 1,
                        'medium': 2,
                        'low': 3,
                        'none': 4
                      };
                      return (priorityOrder[a.priority] - priorityOrder[b.priority]) * dir;
                    }

                    case 'date': {
                      if (!a.plannedStart && !b.plannedStart) return 0;
                      if (!a.plannedStart) return 1;
                      if (!b.plannedStart) return -1;
                      
                      const startA = new Date(a.plannedStart).getTime();
                      const startB = new Date(b.plannedStart).getTime();
                      
                      if (startA !== startB) return (startA - startB) * dir;
                      
                      // Tie breaker with plannedEnd
                      const endA = a.plannedEnd ? new Date(a.plannedEnd).getTime() : Infinity;
                      const endB = b.plannedEnd ? new Date(b.plannedEnd).getTime() : Infinity;
                      return (endA - endB) * dir;
                    }
                  }
                }
                
                // Manual order (position)
                return (a.position ?? 0) - (b.position ?? 0);
              }).map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  groupColor={group.color}
                  onClick={() => setSelectedTask(task)}
                  draggable={canEditTasks && !sort.column}
                  onDragStart={canEditTasks && !sort.column ? e => handleDragStart(e, task.id) : undefined}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedTaskId === task.id}
                />
              ))}
            </div>
          </div>
        );
      })}
      {/* Drop indicator at end */}
      {draggedGroupId && groupDropIndex !== null && groupDropIndex >= groups.length && <GroupDropLine />}

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
