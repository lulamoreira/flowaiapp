import { useParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { Header } from '@/components/layout/Header';
import { BoardTable } from '@/components/board/BoardTable';
import { BoardKanban } from '@/components/board/BoardKanban';
import { BoardCalendar } from '@/components/board/BoardCalendar';
import { BoardCharts } from '@/components/board/BoardCharts';
import { BoardGantt } from '@/components/board/BoardGantt';
import { BoardWorkload } from '@/components/board/BoardWorkload';
import { AutomationPanel } from '@/components/automation/AutomationPanel';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Table, Columns3, Plus, Pencil, Check, X, CalendarDays, GanttChart, Users, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/usePermissions';
import { PublicTimelineDialog } from '@/components/board/PublicTimelineDialog';
import { RescheduleDialog } from '@/components/board/RescheduleDialog';
import { ProjectMembersDialog } from '@/components/board/ProjectMembersDialog';

type ViewMode = 'table' | 'kanban' | 'calendar' | 'gantt' | 'workload' | 'automation';

const BoardPage = () => {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useAppStore();
  const board = state.boards.find(b => b.id === id);
  const [view, setView] = useState<ViewMode>('table');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState(board?.title ?? '');
  const [descDraft, setDescDraft] = useState(board?.description ?? '');
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const { canEdit, canDelete, isAdminOrCoordinator } = usePermissions();
  const canEditBoard = canEdit('boards');
  const canEditTasks = canEdit('tasks');
  const canDeleteTasks = canDelete('tasks');

  if (!board) return <div className="p-6 text-muted-foreground">Board não encontrado</div>;

  const addGroup = () => {
    const colors = ['#0073ea', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#579bfc'];
    const newGroup = {
      id: crypto.randomUUID(),
      title: 'Novo Grupo',
      color: colors[state.groups.filter(g => g.boardId === id).length % colors.length],
      boardId: id!,
      collapsed: false,
    };
    dispatch({ type: 'ADD_GROUP', payload: newGroup });
    toast.success('Novo grupo criado');
  };

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

  const tabs: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'table', label: 'Tabela', icon: <Table className="h-3.5 w-3.5 mr-1" /> },
    { key: 'kanban', label: 'Kanban', icon: <Columns3 className="h-3.5 w-3.5 mr-1" /> },
    { key: 'gantt', label: 'Linha do Tempo', icon: <GanttChart className="h-3.5 w-3.5 mr-1" /> },
    { key: 'calendar', label: 'Calendário', icon: <CalendarDays className="h-3.5 w-3.5 mr-1" /> },
    { key: 'workload', label: 'Equipe', icon: <Users className="h-3.5 w-3.5 mr-1" /> },
    { key: 'automation', label: 'Automações', icon: <Zap className="h-3.5 w-3.5 mr-1" /> },
  ];

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
              className={`text-xl font-bold text-foreground flex items-center gap-2 group/title mb-1 ${canEditBoard ? 'cursor-pointer' : ''}`}
              onClick={() => { if (canEditBoard) { setTitleDraft(board.title); setEditingTitle(true); } }}
            >
              {board.title}
              {canEditBoard && (
                <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity" />
              )}
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
            <div
              className={`text-sm text-muted-foreground transition-colors group/desc flex flex-col items-start gap-1 whitespace-pre-wrap ${canEditBoard ? 'cursor-pointer hover:text-foreground' : ''}`}
              onClick={() => { if (canEditBoard) { setDescDraft(board.description); setEditingDesc(true); } }}
            >
              {board.description ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {board.description.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace('## ', '')}</h2>;
                    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold mt-2">{line.replace(/\*\*/g, '')}</p>;
                    if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ')) return <li key={i} className="ml-4">{line.replace(/^\d+\. /, '')}</li>;
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              ) : (
                canEditBoard ? 'Clique para adicionar uma descrição...' : 'Sem descrição'
              )}
              {canEditBoard && !board.description && (
                <Pencil className="h-3 w-3 opacity-0 group-hover/desc:opacity-100 transition-opacity" />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {tabs.map(tab => (
            <Button
              key={tab.key}
              variant={view === tab.key ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setView(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2">
              {(isAdminOrCoordinator || canEditBoard) && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => setMembersDialogOpen(true)}
                >
                  <Users className="h-3.5 w-3.5 mr-1" />
                  Autorização
                </Button>
              )}
              {canEditTasks && (
                <RescheduleDialog 
                  board={board} 
                  tasks={state.tasks.filter(t => t.boardId === board.id)} 
                />
              )}
              {canEditTasks && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={renumbering}
                  onClick={renumberBoard}
                >
                  <ListOrdered className="h-3.5 w-3.5 mr-1" />
                  {renumbering ? 'Renumerando...' : 'Renumerar quadro'}
                </Button>
              )}
              <PublicTimelineDialog
                boardId={board.id}
                initialEnabled={(board as any).public_timeline_enabled}
                publicToken={(board as any).public_token}
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addGroup}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Novo Grupo
            </Button>
          </div>
        </div>

        {view === 'table' && (
          <div className="space-y-6">
            <BoardCharts boardId={board.id} />
            <BoardTable boardId={board.id} />
          </div>
        )}
        {view === 'kanban' && <BoardKanban boardId={board.id} />}
        {view === 'gantt' && <BoardGantt boardId={board.id} />}
        {view === 'calendar' && <BoardCalendar boardId={board.id} />}
        {view === 'workload' && <BoardWorkload boardId={board.id} />}
        {view === 'automation' && <AutomationPanel boardId={board.id} />}
      </main>

      <ProjectMembersDialog 
        open={membersDialogOpen} 
        onOpenChange={setMembersDialogOpen} 
        boardId={board.id} 
      />
    </div>
  );
};

export default BoardPage;
