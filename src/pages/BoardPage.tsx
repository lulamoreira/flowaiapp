import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/layout/Header';
import { BoardTable } from '@/components/board/BoardTable';
import { BoardKanban } from '@/components/board/BoardKanban';
import { BoardCharts } from '@/components/board/BoardCharts';
import { AutomationPanel } from '@/components/automation/AutomationPanel';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3, Zap, Table, Columns3, Plus, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const BoardPage = () => {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useAppStore();
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
    toast.success('Novo grupo criado');
  };

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState(board.title);
  const [descDraft, setDescDraft] = useState(board.description);

  const saveTitle = () => {
    if (titleDraft.trim()) {
      dispatch({ type: 'UPDATE_BOARD', payload: { ...board, title: titleDraft.trim() } });
      toast.success('Título atualizado');
    }
    setEditingTitle(false);
  };

  const saveDesc = () => {
    dispatch({ type: 'UPDATE_BOARD', payload: { ...board, description: descDraft.trim() } });
    toast.success('Descrição atualizada');
    setEditingDesc(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title={board.title} />
      <main className="flex-1 p-6 overflow-y-auto bg-muted/30">
        {/* Editable title & description */}
        <div className="mb-4">
          {editingTitle ? (
            <div className="flex items-center gap-2 mb-1">
              <Input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="text-xl font-bold h-9 w-72"
                autoFocus
              />
              <button onClick={saveTitle} className="text-green-600"><Check className="h-4 w-4" /></button>
              <button onClick={() => setEditingTitle(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <h2
              className="text-xl font-bold text-foreground flex items-center gap-2 group/title cursor-pointer mb-1"
              onClick={() => { setTitleDraft(board.title); setEditingTitle(true); }}
            >
              {board.title}
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
            </h2>
          )}
          {editingDesc ? (
            <div className="flex items-start gap-2">
              <Textarea
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setEditingDesc(false); }}
                className="text-sm min-h-[60px] w-96"
                placeholder="Adicione uma descrição..."
                autoFocus
              />
              <div className="flex flex-col gap-1 mt-1">
                <button onClick={saveDesc} className="text-green-600"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditingDesc(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>
            </div>
          ) : (
            <p
              className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors group/desc flex items-center gap-1"
              onClick={() => { setDescDraft(board.description); setEditingDesc(true); }}
            >
              {board.description || 'Clique para adicionar uma descrição...'}
              <Pencil className="h-3 w-3 opacity-0 group-hover/desc:opacity-100 transition-opacity" />
            </p>
          )}
        </div>
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
          <div className="ml-auto">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addGroup}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Grupo
            </Button>
          </div>
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
