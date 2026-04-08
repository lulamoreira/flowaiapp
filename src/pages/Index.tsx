import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/layout/Header';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LayoutDashboard, Plus } from 'lucide-react';
import { Board } from '@/types';

const Index = () => {
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();

  const handleCreateBoard = () => {
    const colors = ['#0073ea', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#579bfc'];
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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title="Início" />
      <main className="flex-1 p-6 overflow-y-auto bg-muted/30">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-1">Bom dia! 👋</h2>
          <p className="text-sm text-muted-foreground">Acesse rapidamente seus boards de trabalho</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.boards.map(board => {
            const taskCount = state.tasks.filter(t => t.boardId === board.id).length;
            const doneCount = state.tasks.filter(t => t.boardId === board.id && t.status === 'done').length;
            return (
              <div
                key={board.id}
                onClick={() => navigate(`/board/${board.id}`)}
                className="bg-card border border-border rounded-lg p-5 cursor-pointer hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: board.color + '20' }}>
                    <LayoutDashboard className="h-5 w-5" style={{ color: board.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-[#0073ea] transition-colors">{board.title}</h3>
                    <p className="text-xs text-muted-foreground">{board.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{taskCount} tarefas · {doneCount} concluídas</span>
                  <span>Atualizado {format(parseISO(board.updatedAt), "dd MMM", { locale: ptBR })}</span>
                </div>
                {taskCount > 0 && (
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(doneCount / taskCount) * 100}%`, backgroundColor: board.color }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {/* New board card */}
          <div
            onClick={handleCreateBoard}
            className="bg-card border border-dashed border-border rounded-lg p-5 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all flex items-center justify-center min-h-[120px]"
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">Novo Board</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
