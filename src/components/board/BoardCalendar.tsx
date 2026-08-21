import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Task, STATUS_CONFIG } from '@/types';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';
import { PriorityBadge } from './PriorityBadge';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, parseISO, isSameMonth, isSameDay, isToday,
  addMonths, subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatTaskDate } from '@/lib/dateUtils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScopedTasks } from '@/hooks/useScopedTasks';

interface BoardCalendarProps {
  boardId: string;
}

export function BoardCalendar({ boardId }: BoardCalendarProps) {
  const { state, dispatch } = useAppStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const { filterTasks } = useScopedTasks();
  const tasks = useMemo(
    () => filterTasks(state.tasks.filter(t => t.boardId === boardId && t.plannedEnd)),
    [state.tasks, boardId, filterTasks]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      const key = t.plannedEnd ? t.plannedEnd.substring(0, 10) : '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [tasks]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold text-foreground capitalize">
          {formatTaskDate(currentMonth, 'MMMM yyyy')}
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {weekDays.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate.get(dateKey) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);

          return (
            <div
              key={i}
              className={`min-h-[100px] border-b border-r border-border p-1.5 transition-colors ${
                !inMonth ? 'bg-muted/20' : ''
              } ${today ? 'bg-primary/5' : ''} ${dragOverDate === dateKey ? 'ring-2 ring-inset ring-primary/50 bg-primary/10' : ''}`}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDate(dateKey); }}
              onDragLeave={() => setDragOverDate(null)}
              onDrop={e => {
                e.preventDefault();
                setDragOverDate(null);
                if (!draggedTaskId) return;
                const task = state.tasks.find(t => t.id === draggedTaskId);
                if (task && (task.plannedEnd || '').substring(0, 10) !== dateKey) {
                  dispatch({ type: 'UPDATE_TASK', payload: { ...task, plannedEnd: dateKey } });
                }
                setDraggedTaskId(null);
              }}
            >
              <div className={`text-xs font-medium mb-1 ${
                today ? 'text-primary font-bold' : inMonth ? 'text-foreground' : 'text-muted-foreground/50'
              }`}>
                {formatTaskDate(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => {
                  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG['not_started'];

                  const group = state.groups.find(g => g.id === task.groupId);
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => { setDraggedTaskId(task.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDraggedTaskId(null); setDragOverDate(null); }}
                      onClick={() => setSelectedTask(task)}
                      className={`text-[10px] leading-tight px-1.5 py-0.5 rounded cursor-grab truncate hover:opacity-80 transition-all text-white font-medium ${
                        draggedTaskId === task.id ? 'opacity-40 scale-95' : ''
                      }`}
                      style={{ backgroundColor: group?.color || statusConfig.color }}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  );
                })}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1.5">
                    +{dayTasks.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
