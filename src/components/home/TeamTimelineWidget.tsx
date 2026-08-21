import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, differenceInDays, format, parseISO, startOfDay, isBefore, startOfMonth, endOfMonth, getDaysInMonth, isSameDay, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatTaskDate } from '@/lib/dateUtils';

import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, GanttChartSquare, CalendarDays, LayoutGrid } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';


const ROW_HEIGHT = 44;
const NAME_COL = 240;

interface ProfileLite {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export function TeamTimelineWidget() {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [mode, setMode] = useState<'week' | 'month'>(() => (localStorage.getItem('flowai-timeline-mode') as 'week' | 'month') || 'week');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    localStorage.setItem('flowai-timeline-mode', mode);
  }, [mode]);


  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, avatar_url');
      const map: Record<string, ProfileLite> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = { user_id: p.user_id, full_name: p.full_name || 'Sem nome', avatar_url: p.avatar_url };
      });
      setProfiles(map);
    })();
  }, []);

  const boardsById = useMemo(() => {
    const m: Record<string, typeof state.boards[number]> = {};
    state.boards.forEach(b => { m[b.id] = b; });
    return m;
  }, [state.boards]);

  const today = startOfDay(new Date());

  const timelineStart = useMemo(() => {
    if (mode === 'week') {
      return addDays(today, offset * 7);
    }
    const targetMonth = addMonths(startOfMonth(today), offset);
    return targetMonth;
  }, [today, offset, mode]);

  const timelineEnd = useMemo(() => {
    if (mode === 'week') {
      return addDays(timelineStart, 6);
    }
    return endOfMonth(timelineStart);
  }, [timelineStart, mode]);

  const visibleDaysCount = useMemo(() => {
    return differenceInDays(timelineEnd, timelineStart) + 1;
  }, [timelineStart, timelineEnd]);

  const dayWidth = useMemo(() => {
    if (mode === 'week') return 110;
    // For month, we try to fit it. Standard width is smaller.
    return 36; 
  }, [mode]);

  const days = useMemo(
    () => Array.from({ length: visibleDaysCount }, (_, i) => addDays(timelineStart, i)),
    [timelineStart, visibleDaysCount]
  );


  // Tasks visible if their planned range intersects the visible week
  const rows = useMemo(() => {
    const filtered = state.tasks.filter(t => {
      if (!t.plannedStart && !t.plannedEnd) return false;
      const s = t.plannedStart ? startOfDay(parseISO(t.plannedStart)) : null;
      const e = t.plannedEnd ? startOfDay(parseISO(t.plannedEnd)) : null;
      const start = s || e!;
      const end = e || s!;
      return end >= timelineStart && start <= timelineEnd;
    });
    return filtered.sort((a, b) => {
      const aS = a.plannedStart ? parseISO(a.plannedStart).getTime() : 0;
      const bS = b.plannedStart ? parseISO(b.plannedStart).getTime() : 0;
      return aS - bS;
    });
  }, [state.tasks, timelineStart, timelineEnd]);

  const getBar = (task: typeof rows[number]) => {
    const start = task.plannedStart ? startOfDay(parseISO(task.plannedStart)) : null;
    const end = task.plannedEnd ? startOfDay(parseISO(task.plannedEnd)) : null;
    if (!start && !end) return null;
    const s = start || end!;
    const e = end || start!;

    // clip to visible window
    const visibleStart = s < timelineStart ? timelineStart : s;
    const visibleEnd = e > timelineEnd ? timelineEnd : e;

    const left = differenceInDays(visibleStart, timelineStart) * dayWidth;
    const width = Math.max((differenceInDays(visibleEnd, visibleStart) + 1) * dayWidth, dayWidth);

    const isOverdue = end && isBefore(e, today) && task.status !== 'done';
    const clippedLeft = s < timelineStart;
    const clippedRight = e > timelineEnd;
    return { left, width, isOverdue, clippedLeft, clippedRight };
  };

  const getInitials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '??';

  const navigationLabel = useMemo(() => {
    if (mode === 'month') {
      return format(timelineStart, "MMMM yyyy", { locale: ptBR });
    }
    if (offset === 0) return 'Esta semana';
    if (offset === 1) return 'Próxima semana';
    if (offset === -1) return 'Semana passada';
    return `${formatTaskDate(timelineStart)} – ${formatTaskDate(timelineEnd)}`;
  }, [offset, timelineStart, timelineEnd, mode]);


  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GanttChartSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Linha do tempo da equipe
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup 
            type="single" 
            value={mode} 
            onValueChange={(v) => v && setMode(v as 'week' | 'month')}
            className="bg-muted/50 p-0.5 rounded-lg border border-border"
          >
            <ToggleGroupItem value="week" className="h-7 px-2 text-[10px] uppercase font-bold tracking-tight">
              Semana
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className="h-7 px-2 text-[10px] uppercase font-bold tracking-tight">
              Mês
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center bg-card border border-border rounded-md shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setOffset(o => o - 1)}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setOffset(0)}
              className="text-[11px] px-2 font-semibold text-foreground min-w-[120px] text-center capitalize"
            >
              {navigationLabel}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setOffset(o => o + 1)}
              aria-label="Próximo"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>


      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-8 text-center bg-card">
          <p className="text-sm text-muted-foreground">
            Nenhuma tarefa planejada para esta semana.
          </p>
        </div>
      ) : (
        <TooltipProvider delayDuration={150}>
          <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="overflow-auto scrollbar-thin" style={{ maxHeight: 420 }}>
              <div style={{ width: NAME_COL + visibleDaysCount * dayWidth, minHeight: 50 + rows.length * ROW_HEIGHT }}>

                {/* Header */}
                <div className="flex sticky top-0 z-20 bg-card border-b border-border">
                  <div
                    className="shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground border-r border-border sticky left-0 bg-card z-30"
                    style={{ width: NAME_COL }}
                  >
                    Responsável / Tarefa
                  </div>
                  <div className="flex">
                    {days.map((day, i) => {
                      const isToday = differenceInDays(day, today) === 0;
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <div
                          key={i}
                          className={`text-center flex flex-col justify-center text-[11px] border-r border-border py-1.5 ${isToday ? 'bg-primary/10 font-bold text-primary' : isWeekend ? 'bg-muted/40 text-muted-foreground' : 'text-muted-foreground'}`}
                          style={{ width: dayWidth }}
                        >

                          {mode === 'week' ? (
                            <>
                              <div className="text-[10px] uppercase">{formatTaskDate(day, 'EEE')}</div>
                              <div className="font-semibold text-foreground/80">{formatTaskDate(day, 'dd/MM')}</div>
                            </>
                          ) : (
                            <div className="font-semibold text-[10px] text-foreground/80">{formatTaskDate(day, 'd')}</div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rows */}
                {rows.map(task => {
                  const bar = getBar(task);
                  const board = boardsById[task.boardId];
                  const profile = task.assignee ? profiles[task.assignee] : null;
                  const memberName = profile?.full_name || 'Sem responsável';
                  return (
                    <div
                      key={task.id}
                      className="flex border-b border-border/50 hover:bg-muted/20"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div
                        className="shrink-0 px-3 flex items-center gap-2 border-r border-border sticky left-0 bg-card z-10"
                        style={{ width: NAME_COL }}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="h-7 w-7 shrink-0 cursor-pointer ring-1 ring-border">
                              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={memberName} />}
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                {getInitials(memberName)}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            {memberName}
                          </TooltipContent>
                        </Tooltip>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground truncate font-medium">{task.title}</div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                            {board && <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: board.color }} />}
                            <span className="truncate">{board?.title || 'Sem projeto'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="relative flex-1" style={{ width: visibleDaysCount * dayWidth }}>
                        {/* Today column highlight */}
                        {offset === 0 && days.some(d => isSameDay(d, today)) && (
                          <div
                            className="absolute top-0 bottom-0 bg-primary/5 pointer-events-none"
                            style={{ 
                              left: differenceInDays(today, timelineStart) * dayWidth, 
                              width: dayWidth 
                            }}
                          />
                        )}

                        {bar && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                  onClick={() => navigate(`/board/${task.boardId}`)}
                                  className={`absolute top-2 cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 hover:shadow-md flex items-center px-1.5 ${bar.isOverdue ? 'bg-destructive/80 hover:bg-destructive' : ''} ${bar.clippedLeft ? 'rounded-r-md' : 'rounded-l-md'} ${bar.clippedRight ? 'rounded-l-md' : 'rounded-r-md'} ${!bar.clippedLeft && !bar.clippedRight ? 'rounded-md' : ''}`}
                                  style={{
                                    left: bar.left,
                                    width: bar.width,
                                    height: ROW_HEIGHT - 16,
                                    backgroundColor: bar.isOverdue ? undefined : (board?.color || '#0073ea'),
                                  }}
                                >
                                  <span className="text-[10px] text-white truncate font-medium">
                                    {mode === 'week' ? task.title : ''}
                                  </span>
                                </div>

                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="font-semibold">{task.title}</div>
                              <div className="text-muted-foreground">{board?.title}</div>
                              <div className="text-muted-foreground">Responsável: {memberName}</div>
                              {task.plannedStart && (
                                <div className="text-muted-foreground">
                                  {formatTaskDate(task.plannedStart, 'dd/MM/yyyy')}
                                  {task.plannedEnd && ` → ${formatTaskDate(task.plannedEnd, 'dd/MM/yyyy')}`}
                                </div>
                              )}
                              <div className="text-primary mt-1">Clique para abrir o projeto</div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
