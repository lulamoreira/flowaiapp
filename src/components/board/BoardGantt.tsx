import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Task, TaskGroup } from '@/types';
import { parseISO, differenceInDays, addDays, format, startOfDay, isBefore, isSameDay, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useScopedTasks } from '@/hooks/useScopedTasks';


interface BoardGanttProps {
  boardId: string;
  tasks?: Task[];
  groups?: TaskGroup[];
}

const ROW_HEIGHT = 44;
const TASK_COL = 240;


export function BoardGantt({ boardId, tasks: externalTasks, groups: externalGroups }: BoardGanttProps) {
  const { state, dispatch } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [offset, setOffset] = useState(0); // dias ou meses conforme modo
  const [mode, setMode] = useState<'week' | 'month'>(() => (localStorage.getItem('flowai-gantt-mode') as 'week' | 'month') || 'week');
  const [dragging, setDragging] = useState<{ taskId: string; edge: 'start' | 'end' | 'move'; startX: number; origStart: string; origEnd: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('flowai-gantt-mode', mode);
  }, [mode]);


  const { filterTasks } = useScopedTasks();
  const tasks = useMemo(
    () => externalTasks || filterTasks(state.tasks.filter(t => t.boardId === boardId)),
    [state.tasks, boardId, filterTasks, externalTasks]
  );
  const groups = useMemo(
    () => externalGroups || state.groups.filter(g => g.boardId === boardId),
    [state.groups, boardId, externalGroups]
  );

  const today = startOfDay(new Date());
  const timelineStart = useMemo(() => {
    if (mode === 'week') {
      return addDays(today, offset);
    }
    const targetMonth = addMonths(startOfMonth(today), offset);
    return targetMonth;
  }, [today, offset, mode]);

  const timelineEnd = useMemo(() => {
    if (mode === 'week') {
      return addDays(timelineStart, 13);
    }
    return endOfMonth(timelineStart);
  }, [timelineStart, mode]);

  const visibleDaysCount = useMemo(() => {
    return differenceInDays(timelineEnd, timelineStart) + 1;
  }, [timelineStart, timelineEnd]);

  const dayWidth = mode === 'week' ? 88 : 36;

  const days = useMemo(
    () => Array.from({ length: visibleDaysCount }, (_, i) => addDays(timelineStart, i)),
    [timelineStart, visibleDaysCount]
  );


  const rows = useMemo(() => {
    const rowList: { task: Task; groupColor: string }[] = [];
    groups.forEach(g => {
      tasks.filter(t => t.groupId === g.id).forEach(t => {
        rowList.push({ task: t, groupColor: g.color });
      });
    });
    const groupedIds = new Set(groups.map(g => g.id));
    tasks.filter(t => !groupedIds.has(t.groupId)).forEach(t => {
      rowList.push({ task: t, groupColor: '#94a3b8' });
    });
    return rowList;
  }, [tasks, groups]);

  const getBarPosition = (task: Task) => {
    const start = task.plannedStart ? parseISO(task.plannedStart) : null;
    const end = task.plannedEnd ? parseISO(task.plannedEnd) : null;
    if (!start && !end) return null;

    const s = startOfDay(start || end!);
    const e = startOfDay(end || start!);
    const windowEnd = timelineEnd;

    // Fora da janela?
    if (isBefore(windowEnd, s) || isBefore(e, timelineStart)) return null;

    const clippedStart = isBefore(s, timelineStart) ? timelineStart : s;
    const clippedEnd = isBefore(windowEnd, e) ? windowEnd : e;

    const left = differenceInDays(clippedStart, timelineStart) * dayWidth + 4;
    const width = Math.max((differenceInDays(clippedEnd, clippedStart) + 1) * dayWidth - 8, dayWidth - 8);
    const isOverdue = end && isBefore(startOfDay(e), today) && task.status !== 'done';
    const overflowLeft = isBefore(s, timelineStart);
    const overflowRight = isBefore(windowEnd, e);


    return { left, width, isOverdue, overflowLeft, overflowRight };
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
    const daysDelta = Math.round(dx / dayWidth);
    if (daysDelta === 0) return;

    const task = state.tasks.find(t => t.id === dragging.taskId);
    if (!task) return;

    const newStart = dragging.origStart ? format(addDays(parseISO(dragging.origStart), dragging.edge === 'end' ? 0 : daysDelta), "yyyy-MM-dd'T'HH:mm") : undefined;
    const newEnd = dragging.origEnd ? format(addDays(parseISO(dragging.origEnd), dragging.edge === 'start' ? 0 : daysDelta), "yyyy-MM-dd'T'HH:mm") : undefined;

    dispatch({ type: 'UPDATE_TASK', payload: { ...task, plannedStart: newStart, plannedEnd: newEnd } });
  }, [dragging, state.tasks, dispatch]);

  const handleMouseUp = useCallback(() => setDragging(null), []);

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Nenhuma tarefa neste board.</p>;
  }

  // Cabeçalho do mês (agrupar dias por mês)
  const monthSegments = useMemo(() => {
    const segments: { label: string; span: number }[] = [];
    days.forEach(d => {
      const label = format(d, "MMMM yyyy", { locale: ptBR });
      const last = segments[segments.length - 1];
      if (last && last.label === label) last.span++;
      else segments.push({ label, span: 1 });
    });
    return segments;
  }, [days]);

  const rangeLabel = mode === 'week' 
    ? `${format(days[0], "d 'de' MMM", { locale: ptBR })} – ${format(days[visibleDaysCount - 1], "d 'de' MMM", { locale: ptBR })}`
    : format(timelineStart, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground capitalize">{rangeLabel}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {visibleDaysCount} dias</span>
          </div>

          <ToggleGroup 
            type="single" 
            value={mode} 
            onValueChange={(v) => { if (v) { setMode(v as 'week' | 'month'); setOffset(0); } }}
            className="bg-muted/50 p-0.5 rounded-lg border border-border"
          >
            <ToggleGroupItem value="week" className="h-7 px-2 text-[10px] uppercase font-bold tracking-tight">
              Semana
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className="h-7 px-2 text-[10px] uppercase font-bold tracking-tight">
              Mês
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 shadow-sm" onClick={() => setOffset(o => o - (mode === 'week' ? 7 : 1))}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={offset === 0 ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs font-medium px-3 shadow-sm"
            onClick={() => setOffset(0)}
          >
            Hoje
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 shadow-sm" onClick={() => setOffset(o => o + (mode === 'week' ? 7 : 1))}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>


      <div
        ref={containerRef}
        className="overflow-auto relative select-none"
        style={{ maxHeight: '70vh' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{ width: TASK_COL + visibleDaysCount * dayWidth }}>
          {/* Header: mês */}
          <div className="flex sticky top-0 z-20 bg-card border-b border-border">
            <div
              className="shrink-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-r border-border sticky left-0 bg-card z-30 flex items-center"
              style={{ width: TASK_COL }}
            >
              Tarefa
            </div>
            <div className="flex">
              {monthSegments.map((seg, i) => (
                <div
                  key={i}
                  className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground py-1.5 px-2 border-r border-border bg-muted/20 capitalize"
                  style={{ width: seg.span * dayWidth }}
                >
                  {seg.label}
                </div>
              ))}
            </div>
          </div>

          {/* Header: dias */}
          <div className="flex sticky top-[30px] z-20 bg-card border-b border-border">
            <div
              className="shrink-0 border-r border-border sticky left-0 bg-card z-30"
              style={{ width: TASK_COL, height: 48 }}
            />
            <div className="flex">
              {days.map((day, i) => {
                const isToday = isSameDay(day, today);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-center border-r border-border py-1.5 ${
                      isToday
                        ? 'bg-primary/10'
                        : isWeekend
                        ? 'bg-muted/40'
                        : ''
                    }`}
                    style={{ width: dayWidth, height: 48 }}
                  >
                    <span className={`text-[10px] uppercase tracking-wide ${isToday ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {mode === 'week' ? format(day, 'EEE', { locale: ptBR }) : ''}
                    </span>
                    <span
                      className={`text-sm font-semibold mt-0.5 ${
                        isToday
                          ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                          : 'text-foreground'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>

                  </div>
                );
              })}
            </div>
          </div>

          {/* Linhas */}
          <div className="relative">
            {/* Linha vertical de hoje, atrás das barras */}
            {days.some(d => isSameDay(d, today)) && (
              <div
                className="absolute top-0 bottom-0 w-px bg-primary/50 z-[5] pointer-events-none"
                style={{
                  left: TASK_COL + differenceInDays(today, timelineStart) * dayWidth + dayWidth / 2,
                }}
              />
            )}

            {rows.map(({ task, groupColor }) => {
              const bar = getBarPosition(task);
              return (
                <div
                  key={task.id}
                  className="flex border-b border-border/50 hover:bg-muted/20"
                  style={{ height: ROW_HEIGHT }}
                >
                  <div
                    className="shrink-0 px-3 flex items-center gap-2 text-sm text-foreground border-r border-border cursor-pointer hover:bg-muted/30 sticky left-0 bg-card z-10 truncate"
                    style={{ width: TASK_COL }}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: groupColor }} />
                    <span className="truncate">{task.title}</span>
                  </div>
                  <div className="relative" style={{ width: visibleDaysCount * dayWidth }}>
                    {/* Faixas de fim de semana */}
                    {days.map((day, i) => {
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      if (!isWeekend) return null;
                      return (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 bg-muted/30 pointer-events-none"
                          style={{ left: i * dayWidth, width: dayWidth }}
                        />
                      );
                    })}
                    {bar && (
                      <div
                        className={`absolute top-1.5 rounded-md cursor-pointer transition-all shadow-sm hover:shadow ${
                          bar.isOverdue
                            ? 'bg-destructive/85 hover:bg-destructive'
                            : 'bg-primary/85 hover:bg-primary'
                        } ${bar.overflowLeft ? 'rounded-l-none' : ''} ${bar.overflowRight ? 'rounded-r-none' : ''}`}
                        style={{ left: bar.left, width: bar.width, height: ROW_HEIGHT - 12 }}
                        title={task.title}
                      >
                        {!bar.overflowLeft && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/30 rounded-l-md"
                            onMouseDown={e => handleMouseDown(e, task.id, 'start')}
                          />
                        )}
                        <div
                          className="absolute left-2 right-2 top-0 bottom-0 cursor-grab flex items-center px-1"
                          onMouseDown={e => handleMouseDown(e, task.id, 'move')}
                          onClick={() => setSelectedTask(task)}
                        >
                          <span className="text-[11px] text-white truncate font-medium">{task.title}</span>
                        </div>
                        {!bar.overflowRight && (
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/30 rounded-r-md"
                            onMouseDown={e => handleMouseDown(e, task.id, 'end')}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
