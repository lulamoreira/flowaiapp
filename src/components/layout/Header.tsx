import { Search, Bell, UserPlus, Moon, Sun, AlertTriangle, Clock } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useMemo } from 'react';
import { InviteDialog } from '@/components/invite/InviteDialog';
import { useAppStore } from '@/store/useAppStore';
import { differenceInDays, parseISO, startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const { state } = useAppStore();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('flowai-theme') === 'dark' ||
        (!localStorage.getItem('flowai-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('flowai-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const alerts = useMemo(() => {
    const today = startOfDay(new Date());
    return state.tasks
      .filter(t => t.dueDate && t.status !== 'done')
      .map(t => {
        const days = differenceInDays(parseISO(t.dueDate), today);
        return { ...t, daysLeft: days };
      })
      .filter(t => t.daysLeft <= 2)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [state.tasks]);

  const overdueCount = alerts.filter(a => a.daysLeft < 0).length;
  const soonCount = alerts.filter(a => a.daysLeft >= 0).length;

  return (
    <>
      <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          {title && <h1 className="text-lg font-semibold text-foreground">{title}</h1>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => setDark(d => !d)}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground relative">
                <Bell className="h-4 w-4" />
                {alerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {alerts.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="px-4 py-3 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
                <p className="text-xs text-muted-foreground">
                  {overdueCount > 0 && <span className="text-destructive font-medium">{overdueCount} atrasada{overdueCount > 1 ? 's' : ''}</span>}
                  {overdueCount > 0 && soonCount > 0 && ' · '}
                  {soonCount > 0 && <span className="text-orange-500 font-medium">{soonCount} próxima{soonCount > 1 ? 's' : ''} do prazo</span>}
                  {alerts.length === 0 && 'Nenhuma notificação'}
                </p>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {alerts.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Tudo em dia! 🎉
                  </div>
                )}
                {alerts.map(task => {
                  const overdue = task.daysLeft < 0;
                  const board = state.boards.find(b => b.id === task.boardId);
                  return (
                    <div
                      key={task.id}
                      className="px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/board/${task.boardId}`)}
                    >
                      <div className="flex items-start gap-2">
                        {overdue ? (
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {board?.title} · {overdue
                              ? `Atrasada ${Math.abs(task.daysLeft)} dia${Math.abs(task.daysLeft) > 1 ? 's' : ''}`
                              : task.daysLeft === 0
                                ? 'Vence hoje'
                                : `Vence em ${task.daysLeft} dia${task.daysLeft > 1 ? 's' : ''}`
                            }
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(parseISO(task.dueDate), 'dd MMM', { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="sm"
            className="bg-[#0073ea] hover:bg-[#0060c2] text-white gap-1.5"
            onClick={() => setInviteOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Convidar
          </Button>
        </div>
      </header>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}
