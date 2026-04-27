import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, differenceInDays, format, parseISO, startOfDay, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/layout/Header';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DAY_WIDTH = 36;
const ROW_HEIGHT = 44;
const NAME_COL = 280;

interface ProfileLite {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

const TimelinePage = () => {
  const { state } = useAppStore();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [boardFilter, setBoardFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');

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

  const filteredTasks = useMemo(() => {
    return state.tasks.filter(t => {
      if (!t.plannedStart && !t.plannedEnd) return false;
      if (boardFilter !== 'all' && t.boardId !== boardFilter) return false;
      if (memberFilter !== 'all' && t.assignee !== memberFilter) return false;
      return true;
    });
  }, [state.tasks, boardFilter, memberFilter]);

  const { timelineStart, totalDays, rows } = useMemo(() => {
    if (filteredTasks.length === 0) {
      const today = startOfDay(new Date());
      return { timelineStart: today, totalDays: 30, rows: [] as typeof filteredTasks };
    }
    let minDate = new Date();
    let maxDate = new Date();
    filteredTasks.forEach(t => {
      const s = t.plannedStart ? parseISO(t.plannedStart) : null;
      const e = t.plannedEnd ? parseISO(t.plannedEnd) : null;
      if (s && s < minDate) minDate = s;
      if (e && e > maxDate) maxDate = e;
      if (s && s > maxDate) maxDate = s;
      if (e && e < minDate) minDate = e;
    });
    const start = addDays(startOfDay(minDate), -3);
    const days = Math.max(differenceInDays(maxDate, start) + 10, 30);
    // Sort by board then by start date
    const sorted = [...filteredTasks].sort((a, b) => {
      if (a.boardId !== b.boardId) return (boardsById[a.boardId]?.title || '').localeCompare(boardsById[b.boardId]?.title || '');
      const aS = a.plannedStart ? parseISO(a.plannedStart).getTime() : 0;
      const bS = b.plannedStart ? parseISO(b.plannedStart).getTime() : 0;
      return aS - bS;
    });
    return { timelineStart: start, totalDays: days, rows: sorted };
  }, [filteredTasks, boardsById]);

  const today = startOfDay(new Date());
  const todayOffset = differenceInDays(today, timelineStart);
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(timelineStart, i)), [timelineStart, totalDays]);

  const getBar = (task: typeof rows[number]) => {
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

  const getInitials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '??';

  const allMembers = useMemo(() => Object.values(profiles), [profiles]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Linha do Tempo Geral" />
      <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">Visão geral da equipe</h2>
            <p className="text-sm text-muted-foreground">Todas as tarefas com datas planejadas, em todos os projetos.</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Select value={boardFilter} onValueChange={setBoardFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {state.boards.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {allMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center bg-card">
            <p className="text-sm text-muted-foreground">
              Nenhuma tarefa com datas planejadas encontrada. Adicione datas às tarefas para vê-las aqui.
            </p>
          </div>
        ) : (
          <TooltipProvider delayDuration={150}>
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              <div className="overflow-auto" style={{ maxHeight: '75vh' }}>
                <div style={{ width: NAME_COL + totalDays * DAY_WIDTH, minHeight: 50 + rows.length * ROW_HEIGHT }}>
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
                        <div className="relative flex-1" style={{ width: totalDays * DAY_WIDTH }}>
                          {/* Today line */}
                          <div
                            className="absolute top-0 bottom-0 w-px bg-primary/40 z-[5]"
                            style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                          />
                          {bar && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  onClick={() => navigate(`/board/${task.boardId}`)}
                                  className={`absolute top-2 rounded-md cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 hover:shadow-md flex items-center px-2 ${bar.isOverdue ? 'bg-destructive/80 hover:bg-destructive' : ''}`}
                                  style={{
                                    left: bar.left,
                                    width: bar.width,
                                    height: ROW_HEIGHT - 16,
                                    backgroundColor: bar.isOverdue ? undefined : (board?.color || '#0073ea'),
                                  }}
                                >
                                  <span className="text-[11px] text-white truncate font-medium">
                                    {task.title}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <div className="font-semibold">{task.title}</div>
                                <div className="text-muted-foreground">{board?.title}</div>
                                <div className="text-muted-foreground">Responsável: {memberName}</div>
                                {task.plannedStart && (
                                  <div className="text-muted-foreground">
                                    {format(parseISO(task.plannedStart), 'dd/MM/yyyy', { locale: ptBR })}
                                    {task.plannedEnd && ` → ${format(parseISO(task.plannedEnd), 'dd/MM/yyyy', { locale: ptBR })}`}
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
      </main>
    </div>
  );
};

export default TimelinePage;
