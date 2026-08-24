import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useTimeTracking, formatDuration } from '@/hooks/useTimeTracking';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { parseISO, differenceInDays, startOfDay, subDays, subWeeks, subMonths, isBefore, isAfter, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { useEffect, useCallback } from 'react';

const COLORS = ['#0073ea', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#579bfc', '#ff642e'];

export function ReportCharts() {
  const { state } = useAppStore();
  const [boardFilter, setBoardFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [totalTrackedSeconds, setTotalTrackedSeconds] = useState(0);

  // Fetch total tracked hours
  useEffect(() => {
    if (!state.loading) {
      const fetchHours = async () => {
        const { data } = await supabase.from('time_entries').select('duration_seconds');
        if (data) setTotalTrackedSeconds(data.reduce((sum, e) => sum + e.duration_seconds, 0));
      };
      fetchHours();
    }
  }, [state.loading]);

  const periodRange = useMemo(() => {
    const now = new Date();
    if (periodFilter === 'week') return { start: subWeeks(now, 1), end: now };
    if (periodFilter === 'month') return { start: subMonths(now, 1), end: now };
    if (periodFilter === 'quarter') return { start: subMonths(now, 3), end: now };
    if (periodFilter === 'custom' && customStart && customEnd) return { start: parseISO(customStart), end: parseISO(customEnd) };
    return { start: subMonths(now, 1), end: now };
  }, [periodFilter, customStart, customEnd]);

  const tasks = useMemo(() => {
    let filtered = state.tasks;
    if (boardFilter !== 'all') filtered = filtered.filter(t => t.boardId === boardFilter);
    if (memberFilter !== 'all') filtered = filtered.filter(t => t.assignee === memberFilter);
    return filtered;
  }, [state.tasks, boardFilter, memberFilter]);

  const doneTasks = tasks.filter(t => t.status === 'done');
  const workingTasks = tasks.filter(t => t.status === 'working');
  const stuckTasks = tasks.filter(t => t.status === 'stuck');
  const overdueTasks = tasks.filter(t => {
    if (!t.plannedEnd || t.status === 'done') return false;
    return isBefore(parseISO(t.plannedEnd), new Date());
  });

  // By user chart
  const byUser = useMemo(() => {
    const counts: Record<string, { done: number; working: number; stuck: number }> = {};
    tasks.forEach(t => {
      const user = state.users.find(u => u.id === t.assignee);
      const name = user?.name || 'Sem responsável';
      if (!counts[name]) counts[name] = { done: 0, working: 0, stuck: 0 };
      if (t.status === 'done') counts[name].done++;
      else if (t.status === 'working') counts[name].working++;
      else if (t.status === 'stuck') counts[name].stuck++;
    });
    return Object.entries(counts).map(([name, v]) => ({ name, ...v }));
  }, [tasks, state.users]);

  // Burndown
  const burndown = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return [];
    const today = startOfDay(new Date());
    const points: { day: string; remaining: number }[] = [];

    for (let i = 14; i >= 0; i--) {
      const day = subDays(today, i);
      const dayStr = format(day, 'dd/MM');
      const doneByDay = tasks.filter(t => {
        if (t.status !== 'done' || !t.actualEnd) return false;
        return !isAfter(startOfDay(parseISO(t.actualEnd)), day);
      }).length;
      points.push({ day: dayStr, remaining: total - doneByDay });
    }
    return points;
  }, [tasks]);

  // Status distribution
  const statusDist = useMemo(() => {
    const counts = { 'Não Iniciado': 0, 'Trabalhando': 0, 'Travado': 0, 'Concluído': 0, 'Aguardando': 0 };
    tasks.forEach(t => {
      if (t.status === 'not_started') counts['Não Iniciado']++;
      else if (t.status === 'working') counts['Trabalhando']++;
      else if (t.status === 'stuck') counts['Travado']++;
      else if (t.status === 'done') counts['Concluído']++;
      else if (t.status === 'waiting') counts['Aguardando']++;
    });
    return Object.entries(counts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground mr-auto">Relatórios de Produtividade</h2>
        <Select value={boardFilter} onValueChange={setBoardFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Board" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os boards</SelectItem>
            {state.boards.map(b => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Membro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Última semana</SelectItem>
            <SelectItem value="month">Último mês</SelectItem>
            <SelectItem value="quarter">Último trimestre</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {periodFilter === 'custom' && (
          <>
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-[130px] h-9 text-xs" />
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-[130px] h-9 text-xs" />
          </>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <div className="text-2xl font-bold text-foreground">{tasks.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Total</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto mb-1" style={{ color: '#00c875' }} />
          <div className="text-2xl font-bold" style={{ color: '#00c875' }}>{doneTasks.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Concluídas</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#fdab3d' }}>{workingTasks.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Em Progresso</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <AlertTriangle className="h-5 w-5 mx-auto mb-1" style={{ color: '#e2445c' }} />
          <div className="text-2xl font-bold" style={{ color: '#e2445c' }}>{overdueTasks.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Atrasadas</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <div className="text-2xl font-bold text-foreground">{formatDuration(totalTrackedSeconds)}</div>
          <div className="text-xs text-muted-foreground mt-1">Horas Registradas</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Burndown */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Burndown (últimos 14 dias)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={burndown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="remaining" stroke="#e2445c" strokeWidth={2} dot={{ r: 3 }} name="Restantes" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Workload distribution */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Carga por Membro</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byUser}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="done" stackId="a" fill="#00c875" name="Concluídas" radius={[0, 0, 0, 0]} />
              <Bar dataKey="working" stackId="a" fill="#fdab3d" name="Trabalhando" />
              <Bar dataKey="stuck" stackId="a" fill="#e2445c" name="Travado" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status pie */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição por Status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusDist} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly evolution */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Evolução Semanal</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={burndown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="remaining" stroke="#0073ea" fill="#0073ea" fillOpacity={0.15} name="Restantes" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
