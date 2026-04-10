import { Bell, UserPlus, Moon, Sun, Check } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { InviteDialog } from '@/components/invite/InviteDialog';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow, parseISO } from 'date-fns';
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
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

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
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Nenhuma notificação'}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
                    <Check className="h-3 w-3 mr-1" />
                    Ler todas
                  </Button>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Tudo em dia! 🎉
                  </div>
                )}
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}
                    onClick={() => {
                      markAsRead(notif.id);
                      if (notif.link) navigate(notif.link);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{notif.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
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
