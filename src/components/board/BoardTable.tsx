import { useState, useMemo } from 'react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addWeeks, parseISO, isWithinInterval, isBefore } from 'date-fns';
import { useAppStore } from '@/store/useAppStore';
import { Task } from '@/types';
import { GroupHeader } from './GroupHeader';
import { TaskRow } from './TaskRow';
import { SearchFilterBar } from './SearchFilterBar';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';
import { toast } from 'sonner';

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

  const groups = state.groups.filter(g => g.boardId === boardId);
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
        if (dueDateFilter === 'no_date') return !t.dueDate;
        if (!t.dueDate) return false;
        const d = parseISO(t.dueDate);
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

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
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
      <div className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
        <div className="w-7" />
        <div className="w-1" />
        <div className="flex-1 px-3 min-w-[200px]">Item</div>
        <div className="w-[140px] px-2 text-center">Responsável</div>
        <div className="w-[130px] px-2 text-center">Status</div>
        <div className="w-[110px] px-2 text-center">Prioridade</div>
        <div className="w-[100px] px-2">Data</div>
      </div>

      {groups.map(group => {
        const groupTasks = filteredTasks.filter(t => t.groupId === group.id);
        const isDragOver = dragOverGroupId === group.id;
        return (
          <div
            key={group.id}
            className={`rounded-lg border overflow-hidden bg-card transition-colors ${
              isDragOver ? 'border-primary ring-1 ring-primary/30' : 'border-border'
            }`}
            onDragOver={e => handleDragOver(e, group.id)}
            onDragLeave={() => setDragOverGroupId(null)}
            onDrop={e => handleDrop(e, group.id)}
          >
            <GroupHeader
              group={group}
              taskCount={groupTasks.length}
              onToggle={() => dispatch({ type: 'TOGGLE_GROUP', payload: group.id })}
              onAddTask={() => addTask(group.id)}
              onRename={(title) => { dispatch({ type: 'UPDATE_GROUP', payload: { ...group, title } }); toast.success(`Grupo renomeado para "${title}"`); }}
              onDelete={() => { dispatch({ type: 'DELETE_GROUP', payload: group.id }); toast.success(`Grupo "${group.title}" excluído`); }}
            />
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
        );
      })}

      <TaskDetailModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
