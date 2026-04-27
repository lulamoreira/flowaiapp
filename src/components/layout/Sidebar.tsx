import { LayoutDashboard, BarChart3, Plus, Pencil, Trash2, Star, Shield, LogOut, User } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import { Board } from '@/types';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const BOARD_COLORS = ['#0073ea', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#579bfc', '#ff642e'];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { state: appState, dispatch } = useAppStore();
  const { isAdminOrCoordinator, isAdmin, signOut } = useAuth();
  const { canEdit, canDelete } = usePermissions();
  const canEditBoards = canEdit('boards');
  const canDeleteBoards = canDelete('boards');
  const navigate = useNavigate();
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardColor, setNewBoardColor] = useState(BOARD_COLORS[0]);

  const handleCreateBoard = () => {
    if (!newBoardTitle.trim()) return;
    const board: Board = {
      id: crypto.randomUUID(),
      title: newBoardTitle.trim(),
      description: '',
      color: newBoardColor,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    dispatch({ type: 'ADD_BOARD', payload: board });
    setNewBoardTitle('');
    setNewBoardColor(BOARD_COLORS[0]);
    setShowNewBoard(false);
    navigate(`/board/${board.id}`);
    toast.success(`Board "${board.title}" criado com sucesso`);
  };

  return (
    <>
      <Sidebar collapsible="icon" className="border-r-0" style={{ '--sidebar-width': '260px' } as React.CSSProperties}>
        <SidebarContent className="bg-[#292f4c] text-[#c3c6d4]">
          {/* Logo */}
          <div className="flex items-center gap-2 px-4 py-5 border-b border-[#3c4260]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6c6ff5] to-[#ab68ff] flex items-center justify-center text-xs font-bold text-white shrink-0">
              F
            </div>
            {!collapsed && <span className="text-lg font-bold text-white tracking-tight">FlowAI</span>}
          </div>

          {/* Main nav */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/" end className="text-[#c3c6d4] hover:bg-[#3c4260] hover:text-white rounded-md" activeClassName="bg-[#3c4260] text-white">
                      <LayoutDashboard className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Início</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/reports" className="text-[#c3c6d4] hover:bg-[#3c4260] hover:text-white rounded-md" activeClassName="bg-[#3c4260] text-white">
                      <BarChart3 className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Relatórios</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isAdminOrCoordinator && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/admin" className="text-[#c3c6d4] hover:bg-[#3c4260] hover:text-white rounded-md" activeClassName="bg-[#3c4260] text-white">
                        <Shield className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{isAdmin ? 'Admin' : 'Coordenação'}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Favoritos */}
          {appState.boards.some(b => b.favorite) && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-[#9699a8] text-xs uppercase tracking-wider px-4">
                {!collapsed && <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> Favoritos</span>}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {appState.boards.filter(b => b.favorite).map(board => (
                    <SidebarMenuItem key={board.id}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={`/board/${board.id}`}
                          className="text-[#c3c6d4] hover:bg-[#3c4260] hover:text-white rounded-md"
                          activeClassName="bg-[#3c4260] text-white"
                        >
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
                          {!collapsed && <span className="truncate">{board.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Boards */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[#9699a8] text-xs uppercase tracking-wider px-4 flex items-center justify-between">
              {!collapsed && <span>Boards</span>}
              {canEditBoards && (
                <button
                  onClick={() => setShowNewBoard(true)}
                  className="text-[#9699a8] hover:text-white transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {appState.boards.map(board => (
                  <SidebarMenuItem key={board.id} className="group/board">
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={`/board/${board.id}`}
                        className="text-[#c3c6d4] hover:bg-[#3c4260] hover:text-white rounded-md"
                        activeClassName="bg-[#3c4260] text-white"
                      >
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: board.color }} />
                        {!collapsed && <span className="truncate flex-1">{board.title}</span>}
                        {!collapsed && (
                          <span className="flex items-center gap-0.5 opacity-0 group-hover/board:opacity-100 transition-opacity ml-auto">
                            {canEditBoards && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  const name = prompt('Renomear board:', board.title);
                                  if (name?.trim()) {
                                    dispatch({ type: 'UPDATE_BOARD', payload: { ...board, title: name.trim() } });
                                    toast.success(`Board renomeado para "${name.trim()}"`);
                                  }
                                }}
                                className="p-0.5 hover:text-white"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                            {canDeleteBoards && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  if (confirm(`Excluir board "${board.title}" e todas suas tarefas?`)) {
                                    dispatch({ type: 'DELETE_BOARD', payload: board.id });
                                    navigate('/');
                                    toast.success(`Board "${board.title}" excluído`);
                                  }
                                }}
                                className="p-0.5 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* User section */}
          <div className="mt-auto px-4 py-3 border-t border-[#3c4260] space-y-1">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 text-[#c3c6d4] hover:text-white text-sm w-full transition-colors rounded-md px-1 py-1.5 hover:bg-[#3c4260]"
            >
              <User className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Meu Perfil</span>}
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-[#9699a8] hover:text-white text-sm w-full transition-colors px-1 py-1.5"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </button>
          </div>
        </SidebarContent>
      </Sidebar>

      <Dialog open={showNewBoard} onOpenChange={setShowNewBoard}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Novo Board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Nome do board"
              value={newBoardTitle}
              onChange={e => setNewBoardTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateBoard()}
              autoFocus
            />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Cor</p>
              <div className="flex gap-2">
                {BOARD_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewBoardColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${newBoardColor === c ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleCreateBoard} className="w-full" disabled={!newBoardTitle.trim()}>
              Criar Board
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
