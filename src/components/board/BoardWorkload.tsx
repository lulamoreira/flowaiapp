import { useMemo, useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { parseISO, startOfDay, addDays, differenceInDays, format, isWithinInterval, startOfWeek, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { useScopedTasks } from '@/hooks/useScopedTasks';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BoardWorkloadProps {
  boardId: string;
}

const CELL_WIDTH = 80;
const DEFAULT_CAPACITY = 8; // hours per day

export function BoardWorkload({ boardId }: BoardWorkloadProps) {
  const { state } = useAppStore();
  const [capacityMap, setCapacityMap] = useState<Record<string, number>>({});
  const [authorizedUserIds, setAuthorizedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');

  const { filterTasks } = useScopedTasks();
  const tasks = useMemo(
    () => filterTasks(state.tasks.filter(t => t.boardId === boardId)),
    [state.tasks, boardId, filterTasks]
  );
  const members = useMemo(() => {
    // 1. Members explicitly authorized in project_members
    const authorized = state.users.filter(u => authorizedUserIds.includes(u.id));
    
    // 2. Users (real or placeholders) who have tasks assigned in this board
    // Note: for non-privileged users, filterTasks already limits tasks to those assigned to them.
    const assigneesWithTasks = new Set(tasks.map(t => t.assignee).filter(Boolean));
    const assigned = state.users.filter(u => assigneesWithTasks.has(u.id));

    // Combine and deduplicate by ID
    const combined = [...authorized];
    assigned.forEach(u => {
      if (!combined.some(c => c.id === u.id)) {
        combined.push(u);
      }
    });

    return combined;
  }, [state.users, authorizedUserIds, tasks]);

  useEffect(() => {
    if (!boardId) return;
    const fetchAuthorized = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('project_members' as any)
          .select('user_id')
          .eq('board_id', boardId);
        
        if (error) throw error;
        setAuthorizedUserIds(data?.map((m: any) => m.user_id) || []);
      } catch (err: any) {
        console.error('Error fetching authorized members:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAuthorized();
  }, [boardId]);

  const { periods, loadMap } = useMemo(() => {
    const today = startOfDay(new Date());
    const pds: Date[] = [];

    if (viewMode === 'day') {
      for (let i = -2; i < 12; i++) pds.push(addDays(today, i));
    } else {
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      for (let i = -1; i < 6; i++) pds.push(addWeeks(weekStart, i));
    }

    // Calculate load per member per period
    const map: Record<string, Record<number, number>> = {};
    members.forEach(m => { map[m.id] = {}; });

    tasks.forEach(t => {
      if (!t.assignee || !t.plannedStart || !t.plannedEnd) return;
      const start = startOfDay(parseISO(t.plannedStart));
      const end = startOfDay(parseISO(t.plannedEnd));
      const taskDays = Math.max(differenceInDays(end, start) + 1, 1);
      const hoursPerDay = 8 / taskDays; // distribute 8h across task duration

      pds.forEach((period, pi) => {
        const periodEnd = viewMode === 'day' ? period : addDays(period, 6);
        if (isWithinInterval(start, { start: period, end: periodEnd }) ||
            isWithinInterval(end, { start: period, end: periodEnd }) ||
            (start <= period && end >= periodEnd)) {
          if (!map[t.assignee]) map[t.assignee] = {};
          const daysInPeriod = viewMode === 'day' ? 1 : 5;
          map[t.assignee][pi] = (map[t.assignee][pi] || 0) + (viewMode === 'day' ? hoursPerDay : hoursPerDay * Math.min(taskDays, daysInPeriod));
        }
      });
    });

    return { periods: pds, loadMap: map };
  }, [tasks, members, viewMode]);

  const getColor = (hours: number, capacity: number) => {
    const pct = hours / capacity;
    if (pct === 0) return 'bg-muted/30';
    if (pct <= 0.8) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    if (pct <= 1) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  };

  if (loading) {
    return <div className="p-4 flex justify-center"><p className="text-sm text-muted-foreground animate-pulse">Carregando equipe...</p></div>;
  }

  if (members.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed rounded-lg">
        <p className="text-sm text-muted-foreground mb-4">Nenhum colaborador autorizado neste projeto ainda.</p>
        <p className="text-xs text-muted-foreground">Use o botão "Autorização" no topo da página para adicionar membros.</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="p-3 border-b border-border flex items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground">Carga de Trabalho</h3>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setViewMode('day')}
            className={`px-2 py-1 text-xs rounded ${viewMode === 'day' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            Dia
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-2 py-1 text-xs rounded ${viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            Semana
          </button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-[180px] sticky left-0 bg-card z-10">Membro</th>
              <th className="text-center px-1 py-2 text-muted-foreground font-medium w-[60px]">Cap.</th>
              {periods.map((p, i) => (
                <th key={i} className="text-center px-1 py-2 text-muted-foreground font-medium" style={{ minWidth: CELL_WIDTH }}>
                  {viewMode === 'day' ? format(p, 'dd/MM EEE', { locale: ptBR }) : `Sem ${format(p, 'dd/MM', { locale: ptBR })}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map(member => {
              const cap = capacityMap[member.id] || DEFAULT_CAPACITY;
              const periodCap = viewMode === 'day' ? cap : cap * 5;
              return (
                <tr key={member.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className={cn("px-3 py-2 font-medium text-foreground sticky left-0 bg-card z-10", member.isPlaceholder && "italic text-muted-foreground")}>
                    {member.name}
                  </td>
                  <td className="text-center px-1">
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={cap}
                      onChange={e => setCapacityMap(prev => ({ ...prev, [member.id]: Number(e.target.value) || DEFAULT_CAPACITY }))}
                      className="h-6 w-12 text-xs text-center mx-auto"
                    />
                  </td>
                  {periods.map((_, pi) => {
                    const hours = loadMap[member.id]?.[pi] || 0;
                    return (
                      <td key={pi} className="text-center px-1 py-1">
                        <div className={`rounded px-1 py-0.5 text-[11px] font-medium ${getColor(hours, periodCap)}`}>
                          {hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30" /> ≤80%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30" /> 80-100%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30" /> &gt;100%</span>
      </div>
    </div>
  );
}
