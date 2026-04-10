import { useMemo, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Task } from '@/types';
import { parseISO, differenceInDays, addDays, format, startOfDay, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';

interface BoardGanttProps {
  boardId: string;
}

const DAY_WIDTH = 36;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 50;

export function BoardGantt({ boardId }: BoardGanttProps) {
  const { state, dispatch } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragging, setDragging] = useState<{ taskId: string; edge: 'start' | 'end' | 'move'; startX: number; origStart: string; origEnd: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const tasks = state.tasks.filter(t => t.boardId === boardId);
  const groups = state.groups.filter(g => g.boardId === boardId);

  // Calculate timeline range
  const { timelineStart, totalDays, rows } = useMemo(() => {
    const tasksWithDates = tasks.filter(t => t.plannedStart || t.plannedEnd);
    if (tasksWithDates.length === 0) {
      const today = startOfDay(new Date());
      return { timelineStart: today, totalDays: 30, rows: [] };
    }

    let minDate = new Date();
    let maxDate = new Date();
    tasksWithDates.forEach(t => {
      const s = t.plannedStart ? parseISO(t.plannedStart) : null;
      const e = t.plannedEnd ? parseISO(t.plannedEnd) : null;
      if (s && s < minDate) minDate = s;
      if (e && e > maxDate) maxDate = e;
      if (s && s > maxDate) maxDate = s;
      if (e && e < minDate) minDate = e;
    });

    const start = addDays(startOfDay(minDate), -3);
    const days = Math.max(differenceInDays(maxDate, start) + 10, 30);

    // Build rows grouped
    const rowList: { task: Task; groupColor: string; groupTitle: string }[] = [];
    groups.forEach(g => {
      const groupTasks = tasks.filter(t => t.groupId === g.id);
      groupTasks.forEach(t => {
        rowList.push({ task: t, groupColor: g.color, groupTitle: g.title });
      });
    });
    // Ungrouped tasks
    const groupedIds = new Set(groups.map(g => g.id));
    tasks.filter(t => !groupedIds.has(t.groupId)).forEach(t => {
      rowList.push({ task: t, groupColor: '#888', groupTitle: 'Sem grupo' });
    });

    return { timelineStart: start, totalDays: days, rows: rowList };
  }, [tasks, groups]);

  const today = startOfDay(new Date());
  const todayOffset = differenceInDays(today, timelineStart);

  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(timelineStart, i));
  }, [timelineStart, totalDays]);

  const getBarPosition = (task: Task) => {
    const start = task.plannedStart ? parseISO(task.plannedStart) : null;
    const end = task.plannedEnd ? parseISO(task.plannedEnd) : null;
    if (!start && !end) return null;

    const s = start || end!;
    const e = end || start!;
    const left = differenceInDays(startOfDay(s), timelineStart) * DAY_WIDTH;
    const width = Math.max((differenceInDays(startOfDay(e), startOfDay(s)) + 1) * DAY_WIDTH, DAY_WIDTH);
    const isOverdue = end && isBefore(startOfDay(e), today) && task.status !== 'done';

    return { left, width, isOverdue };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, taskId: string, edge: 'start' | 'end' | 'move') => {
    e.stopPropagation();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setDragging({
      taskId,
      edge,
      startX: e.clientX,
      origStart: task.plannedStart || '',
      origEnd: task.plannedEnd || '',
    });
  }, [tasks]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const daysDelta = Math.round(dx / DAY_WIDTH);
    if (daysDelta === 0) return;

    const task = state.tasks.find(t => t.id === dragging.taskId);
    if (!task) return;

    let newStart = dragging.origStart ? format(addDays(parseISO(dragging.origStart), dragging.edge === 'end' ? 0 : daysDelta), "yyyy-MM-dd'T'HH:mm") : undefined;
    let newEnd = dragging.origEnd ? format(addDays(parseISO(dragging.origEnd), dragging.edge === 'start' ? 0 : daysDelta), "yyyy-MM-dd'T'HH:mm") : undefined;

    dispatch({ type: 'UPDATE_TASK', payload: { ...task, plannedStart: newStart, plannedEnd: newEnd } });
  }, [dragging, state.tasks, dispatch]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Nenhuma tarefa neste board.</p>;
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-auto relative select-none"
        style={{ maxHeight: '70vh' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{ width: 250 + totalDays * DAY_WIDTH, minHeight: HEADER_HEIGHT + rows.length * ROW_HEIGHT }}>
          {/* Header */}
          <div className="flex sticky top-0 z-20 bg-card border-b border-border">
            <div className="w-[250px] shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border sticky left-0 bg-card z-30">
              Tarefa
            </div>
            <div className="flex">
              {days.map((day, i) => {
                const isToday = differenceInDays(day, today) === 0;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={`text-center text-[10px] border-r border-border py-1 ${isToday ? 'bg-primary/10 font-bold text-primary' : isWeekend ? 'bg-muted/50 text-muted-foreground' : 'text-muted-foreground'}`}
                    style={{ width: DAY_WIDTH }}
                  >
                    <div>{format(day, 'dd')}</div>
                    <div>{format(day, 'EEE', { locale: ptBR })}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          {rows.map(({ task, groupColor }, rowIndex) => {
            const bar = getBarPosition(task);
            return (
              <div key={task.id} className="flex border-b border-border/50 hover:bg-muted/20" style={{ height: ROW_HEIGHT }}>
                <div
                  className="w-[250px] shrink-0 px-3 flex items-center gap-2 text-sm text-foreground border-r border-border cursor-pointer hover:bg-muted/30 sticky left-0 bg-card z-10 truncate"
                  onClick={() => setSelectedTask(task)}
                >
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: groupColor }} />
                  <span className="truncate">{task.title}</span>
                </div>
                <div className="relative flex-1" style={{ width: totalDays * DAY_WIDTH }}>
                  {/* Today line */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/40 z-[5]"
                    style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                  />
                  {bar && (
                    <div
                      className={`absolute top-1.5 rounded-md cursor-pointer transition-colors ${bar.isOverdue ? 'bg-destructive/80 hover:bg-destructive' : 'bg-primary/70 hover:bg-primary'}`}
                      style={{ left: bar.left, width: bar.width, height: ROW_HEIGHT - 12 }}
                      title={task.title}
                    >
                      {/* Left resize handle */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 rounded-l-md"
                        onMouseDown={e => handleMouseDown(e, task.id, 'start')}
                      />
                      {/* Move area */}
                      <div
                        className="absolute left-2 right-2 top-0 bottom-0 cursor-grab flex items-center px-1"
                        onMouseDown={e => handleMouseDown(e, task.id, 'move')}
                      >
                        <span className="text-[10px] text-white truncate font-medium">{task.title}</span>
                      </div>
                      {/* Right resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 rounded-r-md"
                        onMouseDown={e => handleMouseDown(e, task.id, 'end')}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
