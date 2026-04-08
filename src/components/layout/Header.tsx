import { Search, Bell, UserPlus, Moon, Sun } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { InviteDialog } from '@/components/invite/InviteDialog';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
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
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Bell className="h-4 w-4" />
          </Button>
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
