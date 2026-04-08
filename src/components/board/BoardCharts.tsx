import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface BoardChartsProps {
  boardId: string;
}

export function BoardCharts({ boardId }: BoardChartsProps) {
  const { state } = useAppStore();
  const groups = state.groups.filter(g => g.boardId === boardId);
  const tasks = state.tasks.filter(t => t.boardId === boardId);

  const barData = useMemo(() => {
    return groups.map(g => {
      const groupTasks = tasks.filter(t => t.groupId === g.id);
      const done = groupTasks.filter(t => t.status === 'done').length;
      return { name: g.title, total: groupTasks.length, concluídas: done, pendentes: groupTasks.length - done };
    });
  }, [groups, tasks]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({
      name: PRIORITY_CONFIG[key as keyof typeof PRIORITY_CONFIG].label,
      value,
      color: PRIORITY_CONFIG[key as keyof typeof PRIORITY_CONFIG].color,
    }));
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Progresso por Grupo</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barData}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="concluídas" fill="#00c875" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pendentes" fill="#c4c4c4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição de Prioridades</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label>
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
