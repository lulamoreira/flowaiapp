import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/layout/Header';
import { BoardTable } from '@/components/board/BoardTable';
import { BoardKanban } from '@/components/board/BoardKanban';
import { BoardCharts } from '@/components/board/BoardCharts';
import { AutomationPanel } from '@/components/automation/AutomationPanel';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, Zap, Table, Columns3 } from 'lucide-react';

const BoardPage = () => {
  const { id } = useParams<{ id: string }>();
  const { state } = useAppStore();
  const board = state.boards.find(b => b.id === id);
  const [showCharts, setShowCharts] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [showKanban, setShowKanban] = useState(false);

  if (!board) return <div className="p-6 text-muted-foreground">Board não encontrado</div>;

  const addGroup = () => {
    const colors = ['#0073ea', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#579bfc'];
    const newGroup = {
      id: `g${Date.now()}`,
      title: 'Novo Grupo',
      color: colors[state.groups.filter(g => g.boardId === id).length % colors.length],
      boardId: id!,
      collapsed: false,
    };
    dispatch({ type: 'ADD_GROUP', payload: newGroup });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title={board.title} />
      <main className="flex-1 p-6 overflow-y-auto bg-muted/30">
        <div className="flex items-center gap-2 mb-5">
          <Button
            variant={!showCharts && !showAutomation && !showKanban ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setShowCharts(false); setShowAutomation(false); setShowKanban(false); }}
          >
            <Table className="h-3.5 w-3.5 mr-1" />
            Tabela
          </Button>
          <Button
            variant={showKanban ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setShowKanban(true); setShowCharts(false); setShowAutomation(false); }}
          >
            <Columns3 className="h-3.5 w-3.5 mr-1" />
            Kanban
          </Button>
          <Button
            variant={showCharts ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setShowCharts(true); setShowAutomation(false); setShowKanban(false); }}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            Gráficos
          </Button>
          <Button
            variant={showAutomation ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setShowAutomation(true); setShowCharts(false); setShowKanban(false); }}
          >
            <Zap className="h-3.5 w-3.5 mr-1" />
            Automações
          </Button>
        </div>

        {showCharts && <BoardCharts boardId={board.id} />}
        {showAutomation && <AutomationPanel boardId={board.id} />}
        {showKanban && <BoardKanban boardId={board.id} />}
        {!showCharts && !showAutomation && !showKanban && <BoardTable boardId={board.id} />}
      </main>
    </div>
  );
};

export default BoardPage;
