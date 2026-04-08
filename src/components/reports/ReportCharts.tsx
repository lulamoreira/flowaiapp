import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ReportCharts() {
  const { state } = useAppStore();
  const [boardFilter, setBoardFilter] = useState('all');

  const tasks = boardFilter === 'all' ? state.tasks : state.tasks.filter(t => t.boardId === boardFilter);
  const doneTasks = tasks.filter(t => t.status === 'done');

  const byUser = useMemo(() => {
    const counts: Record<string, number> = {};
    doneTasks.forEach(t => {
      const user = state.users.find(u => u.id === t.assignee);
      const name = user?.name || 'Sem responsável';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, concluídas: value }));
  }, [doneTasks, state.users]);

  const byWeek = useMemo(() => {
    const weeks: Record<string, number> = {};
    doneTasks.forEach(t => {
      if (t.completedAt) {
        const week = t.completedAt.substring(0, 7);
        weeks[week] = (weeks[week] || 0) + 1;
      }
    });
    return Object.entries(weeks).sort().map(([period, count]) => ({ period, concluídas: count }));
  }, [doneTasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Relatórios de Produtividade</h2>
        <Select value={boardFilter} onValueChange={setBoardFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="Filtrar board" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os boards</SelectItem>
            {state.boards.map(b => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Tarefas Concluídas por Usuário</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byUser}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="concluídas" fill="#0073ea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Evolução ao Longo do Tempo</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={byWeek}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="concluídas" stroke="#0073ea" fill="#0073ea" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{tasks.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Total de Tarefas</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#00c875' }}>{doneTasks.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Concluídas</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#fdab3d' }}>{tasks.filter(t => t.status === 'working').length}</div>
          <div className="text-xs text-muted-foreground mt-1">Em Progresso</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold" style={{ color: '#e2445c' }}>{tasks.filter(t => t.status === 'stuck').length}</div>
          <div className="text-xs text-muted-foreground mt-1">Travadas</div>
        </div>
      </div>
    </div>
  );
}
