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

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title={board.title} />
      <main className="flex-1 p-6 overflow-y-auto bg-muted/30">
        <div className="flex items-center gap-2 mb-5">
          <Button
            variant={!showCharts && !showAutomation ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setShowCharts(false); setShowAutomation(false); }}
          >
            <Table className="h-3.5 w-3.5 mr-1" />
            Tabela
          </Button>
          <Button
            variant={showCharts ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setShowCharts(true); setShowAutomation(false); }}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            Gráficos
          </Button>
          <Button
            variant={showAutomation ? 'default' : 'ghost'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setShowAutomation(true); setShowCharts(false); }}
          >
            <Zap className="h-3.5 w-3.5 mr-1" />
            Automações
          </Button>
        </div>

        {showCharts && <BoardCharts boardId={board.id} />}
        {showAutomation && <AutomationPanel boardId={board.id} />}
        {!showCharts && !showAutomation && <BoardTable boardId={board.id} />}
      </main>
    </div>
  );
};

export default BoardPage;
