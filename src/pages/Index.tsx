import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/layout/Header';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LayoutGrid, CheckCircle2, Clock, AlertCircle, Star, Plus } from 'lucide-react';
import { Board } from '@/types';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useDeadlineNotifier } from '@/hooks/useDeadlineNotifier';
import { useAuth } from '@/hooks/useAuth';
import { TeamTimelineWidget } from '@/components/home/TeamTimelineWidget';

const Index = () => {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();
  const { profile, roles } = useAuth();
  useDeadlineNotifier();

  const firstName = useMemo(() => {
    if (!profile?.full_name) return '';
    return profile.full_name.split(' ')[0];
  }, [profile]);

  const roleLabel = useMemo(() => {
    if (roles.includes('admin')) return 'Administrador';
    if (roles.includes('coordinator')) return 'Coordenador';
    if (roles.includes('user')) return 'Usuário';
    return 'Visualizador';
  }, [roles]);

  const isPrivileged = roles.includes('admin') || roles.includes('coordinator');
  const allTasks = useMemo(
    () => (isPrivileged ? state.tasks : state.tasks.filter(t => t.assignee === profile?.user_id)),
    [state.tasks, isPrivileged, profile?.user_id]
  );
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
      id: crypto.randomUUID(),
      title: 'Novo Board',
      description: '',
      color: colors[state.boards.length % colors.length],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    dispatch({ type: 'ADD_BOARD', payload: board });
    navigate(`/board/${board.id}`);
  };

  const toggleFavorite = (e: React.MouseEvent, board: Board) => {
    e.stopPropagation();
    dispatch({ type: 'UPDATE_BOARD', payload: { ...board, favorite: !board.favorite } });
    toast.success(board.favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
  };

  const statCards = [
    { label: 'Total de Tarefas', value: stats.total, icon: LayoutGrid, color: '#0073ea', bg: '#e3f2fd' },
    { label: 'Concluídas', value: stats.done, icon: CheckCircle2, color: '#00c875', bg: '#e8f5e9' },
    { label: 'Em Progresso', value: stats.working, icon: Clock, color: '#fdab3d', bg: '#fff3e0' },
    { label: 'Travadas', value: stats.stuck, icon: AlertCircle, color: '#e2445c', bg: '#fce4ec' },
  ];

  const favoriteBoards = useMemo(() =>
    state.boards.filter(b => b.favorite),
    [state.boards]
  );

  const recentBoards = useMemo(() =>
    [...state.boards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.boards]
  );

  const BoardCard = ({ board }: { board: Board }) => {
    const taskCount = state.tasks.filter(t => t.boardId === board.id).length;
    const doneCount = state.tasks.filter(t => t.boardId === board.id && t.status === 'done').length;
    return (
      <div
        onClick={() => navigate(`/board/${board.id}`)}
        className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
      >
        <div className="h-2 w-full" style={{ backgroundColor: board.color }} />
        <div className="p-4">
          <div className="flex items-start justify-between mb-0.5">
            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
              {board.title}
            </h4>
            <button
              onClick={e => toggleFavorite(e, board)}
              className="shrink-0 ml-2 p-0.5"
            >
              <Star
                className={`h-4 w-4 transition-colors ${
                  board.favorite
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground/40 hover:text-yellow-400'
                }`}
              />
            </button>
          </div>
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
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Home" />
      <main className="flex-1 overflow-y-auto bg-muted/30">
        <div className="bg-gradient-to-r from-[#9b59b6] via-[#8e44ed] to-[#6c6ff5] px-8 py-10">
          <h2 className="text-2xl font-bold text-white mb-1">{greeting}{firstName ? `, ${firstName}` : ''}! 👋</h2>
          <div className="flex items-center gap-3">
            <p className="text-white/70 text-sm">Acompanhe rapidamente os seus projetos e tarefas</p>
            <span className="text-xs bg-white/20 text-white px-2.5 py-0.5 rounded-full font-medium">{roleLabel}</span>
          </div>
        </div>

        <div className="px-8 py-6 space-y-8">
          {/* Stats */}
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

          {/* Linha do tempo da equipe */}
          <TeamTimelineWidget />

          {/* Favoritos */}
          {favoriteBoards.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Favoritos</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteBoards.map(board => (
                  <BoardCard key={board.id} board={board} />
                ))}
              </div>
            </div>
          )}

          {/* Boards Recentes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Boards Recentes</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentBoards.map(board => (
                <BoardCard key={board.id} board={board} />
              ))}
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
