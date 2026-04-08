import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { UserPlus, Mail, Check } from 'lucide-react';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const { state, dispatch } = useAppStore();
  const [email, setEmail] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [addedUsers, setAddedUsers] = useState<string[]>([]);

  const filteredUsers = state.users.filter(u =>
    u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  const sendEmailInvite = () => {
    if (!email) return;
    const subject = encodeURIComponent('Convite para entrada no sistema');
    const body = encodeURIComponent(`Olá!\n\nVocê foi convidado para participar do FlowAI, nossa plataforma de gerenciamento de projetos.\n\nAcesse: https://flowai.app\n\nAguardamos você!`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    setEmail('');
  };

  const addExistingUser = (userId: string) => {
    setAddedUsers(prev => [...prev, userId]);
    setTimeout(() => setAddedUsers(prev => prev.filter(id => id !== userId)), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar pessoas</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="existing" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing" className="text-xs">
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Usuário existente
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs">
              <Mail className="h-3.5 w-3.5 mr-1" />
              Convite por email
            </TabsTrigger>
          </TabsList>
          <TabsContent value="existing" className="space-y-3 mt-3">
            <Input
              placeholder="Buscar usuário..."
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              className="h-9"
            />
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {filteredUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between px-3 py-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#0073ea] text-white text-[10px] font-bold flex items-center justify-center">
                      {user.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={addedUsers.includes(user.id) ? 'ghost' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => addExistingUser(user.id)}
                    disabled={addedUsers.includes(user.id)}
                  >
                    {addedUsers.includes(user.id) ? <Check className="h-3.5 w-3.5 text-green-500" /> : 'Adicionar'}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="email" className="space-y-3 mt-3">
            <p className="text-sm text-muted-foreground">
              Envie um convite por email para uma nova pessoa entrar no sistema.
            </p>
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-9"
              onKeyDown={e => e.key === 'Enter' && sendEmailInvite()}
            />
            <Button onClick={sendEmailInvite} className="w-full bg-[#0073ea] hover:bg-[#0060c2] text-white">
              <Mail className="h-4 w-4 mr-2" />
              Enviar convite
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
