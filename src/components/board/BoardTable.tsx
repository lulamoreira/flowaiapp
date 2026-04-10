import { useState, useMemo, useCallback } from 'react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, parseISO, isWithinInterval, isBefore } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { Task } from '@/types';
import { GroupHeader } from './GroupHeader';
import { TaskRow } from './TaskRow';
import { SearchFilterBar } from './SearchFilterBar';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';
import { toast } from 'sonner';
import { GripVertical } from 'lucide-react';

interface BoardTableProps {
  boardId: string;
}

export function BoardTable({ boardId }: BoardTableProps) {
  const { state, dispatch } = useAppStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

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
  const allTasks = state.tasks.filter(t => t.boardId === boardId);

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
      dueDate: '',
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
      <div className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
        <div className="w-7" />
        <div className="w-1" />
        <div className="flex-1 px-3 min-w-[200px]">Item</div>
        <div className="w-[140px] px-2 text-center">Responsável</div>
        <div className="w-[130px] px-2 text-center">Status</div>
        <div className="w-[110px] px-2 text-center">Prioridade</div>
        <div className="w-[100px] px-2">Data</div>
      </div>

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
                  draggable
                  onDragStart={e => handleGroupDragStart(e, group.id)}
                  onDragEnd={handleDragEnd}
                  className="px-1 py-2 cursor-grab hover:bg-muted/50 rounded-l-lg transition-colors self-stretch flex items-center"
                  title="Arrastar para reordenar grupo"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="flex-1">
                  <GroupHeader
                    group={group}
                    taskCount={groupTasks.length}
                    onToggle={() => dispatch({ type: 'TOGGLE_GROUP', payload: group.id })}
                    onAddTask={() => addTask(group.id)}
                    onRename={(title) => { dispatch({ type: 'UPDATE_GROUP', payload: { ...group, title } }); toast.success(`Grupo renomeado para "${title}"`); }}
                    onDelete={() => { dispatch({ type: 'DELETE_GROUP', payload: group.id }); toast.success(`Grupo "${group.title}" excluído`); }}
                  />
                </div>
              </div>
              {!group.collapsed && groupTasks.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  groupColor={group.color}
                  onClick={() => setSelectedTask(task)}
                  draggable
                  onDragStart={e => handleDragStart(e, task.id)}
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
