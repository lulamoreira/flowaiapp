import { LayoutDashboard, BarChart3, Zap, ChevronDown, Plus } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAppStore } from '@/store/useAppStore';
import { useLocation } from 'react-router-dom';
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

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { state: appState } = useAppStore();
  const location = useLocation();

  return (
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Boards */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#9699a8] text-xs uppercase tracking-wider px-4">
            {!collapsed && 'Boards'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {appState.boards.map(board => (
                <SidebarMenuItem key={board.id}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`/board/${board.id}`}
                      className="text-[#c3c6d4] hover:bg-[#3c4260] hover:text-white rounded-md"
                      activeClassName="bg-[#3c4260] text-white"
                    >
                      <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: board.color }} />
                      {!collapsed && <span className="truncate">{board.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
