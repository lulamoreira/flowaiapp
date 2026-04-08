import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/layout/Header';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LayoutGrid, CheckCircle2, Clock, AlertCircle, Star, Plus } from 'lucide-react';
import { Board } from '@/types';
import { useMemo } from 'react';

const Index = () => {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();

  const allTasks = state.tasks;
  const stats = useMemo(() => ({
    total: allTasks.length,
    done: allTasks.filter(t => t.status === 'done').length,
    working: allTasks.filter(t => t.status === 'working').length,
    stuck: allTasks.filter(t => t.status === 'stuck').length,
  }), [allTasks]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const handleCreateBoard = () => {
    const colors = ['#a25ddc', '#0073ea', '#00c875', '#fdab3d', '#e2445c', '#579bfc'];
    const board: Board = {
      id: `b${Date.now()}`,
      title: 'Novo Board',
      description: '',
      color: colors[state.boards.length % colors.length],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    dispatch({ type: 'ADD_BOARD', payload: board });
    navigate(`/board/${board.id}`);
  };

  const statCards = [
    { label: 'Total de Tarefas', value: stats.total, icon: LayoutGrid, color: '#0073ea', bg: '#e3f2fd' },
    { label: 'Concluídas', value: stats.done, icon: CheckCircle2, color: '#00c875', bg: '#e8f5e9' },
    { label: 'Em Progresso', value: stats.working, icon: Clock, color: '#fdab3d', bg: '#fff3e0' },
    { label: 'Travadas', value: stats.stuck, icon: AlertCircle, color: '#e2445c', bg: '#fce4ec' },
  ];

  // Sort boards by updatedAt descending for "recent"
  const recentBoards = useMemo(() =>
    [...state.boards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.boards]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Home" />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        {/* Hero banner with gradient */}
        <div className="bg-gradient-to-r from-[#9b59b6] via-[#8e44ed] to-[#6c6ff5] px-8 py-10">
          <h2 className="text-2xl font-bold text-white mb-1">{greeting}! 👋</h2>
          <p className="text-white/70 text-sm">Acompanhe rapidamente os seus projetos e tarefas</p>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-12">
            {statCards.map(stat => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.bg }}>
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Boards Recentes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Boards Recentes</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentBoards.map(board => {
                const taskCount = state.tasks.filter(t => t.boardId === board.id).length;
                const doneCount = state.tasks.filter(t => t.boardId === board.id && t.status === 'done').length;
                return (
                  <div
                    key={board.id}
                    onClick={() => navigate(`/board/${board.id}`)}
                    className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                  >
                    {/* Colored top bar */}
                    <div className="h-2 w-full" style={{ backgroundColor: board.color }} />
                    <div className="p-4">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-0.5">
                        {board.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        {board.description || 'Sem descrição'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(board.updatedAt), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        {taskCount > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {doneCount}/{taskCount} concluídas
                          </span>
                        )}
                      </div>
                      {taskCount > 0 && (
                        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(doneCount / taskCount) * 100}%`, backgroundColor: board.color }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Add board card */}
              <div
                onClick={handleCreateBoard}
                className="bg-card border border-dashed border-border rounded-xl cursor-pointer hover:shadow-md hover:border-primary/50 transition-all flex items-center justify-center min-h-[140px]"
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Plus className="h-8 w-8" />
                  <span className="text-sm font-medium">Adicionar board</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
