import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Check, Link2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');

  // Link tab state
  const [linkName, setLinkName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const sendEmailInvite = () => {
    if (!email) return;
    const subject = encodeURIComponent('Convite para entrada no sistema');
    const body = encodeURIComponent(`Olá!\n\nVocê foi convidado para participar do FlowAI, nossa plataforma de gerenciamento de projetos.\n\nAcesse: https://flowai.app\n\nAguardamos você!`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    setEmail('');
  };

  const generateLink = async () => {
    const name = linkName.trim();
    if (!name || !user) return;
    if (name.length > 50) {
      toast.error('O nome deve ter no máximo 50 caracteres');
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase
        .from('invitations')
        .insert({ invited_name: name, invited_by: user.id, email: null })
        .select('token')
        .single();
      if (error) throw error;
      const link = `${window.location.origin}/register?token=${data.token}`;
      setGeneratedLink(link);
      toast.success(`Link gerado para ${name}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar link');
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const resetLink = () => {
    setGeneratedLink('');
    setLinkName('');
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetLink(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar pessoas</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="existing" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="existing" className="text-xs">
              <UserPlus className="h-3.5 w-3.5 mr-1" />
              Existente
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs">
              <Mail className="h-3.5 w-3.5 mr-1" />
              Email
            </TabsTrigger>
            <TabsTrigger value="link" className="text-xs">
              <Link2 className="h-3.5 w-3.5 mr-1" />
              Link
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

          <TabsContent value="link" className="space-y-3 mt-3">
            <p className="text-sm text-muted-foreground">
              Digite o primeiro nome da pessoa, gere o link e envie por onde preferir. Ela mesma informará o email no cadastro.
            </p>
            <Input
              placeholder="Primeiro nome"
              value={linkName}
              onChange={e => setLinkName(e.target.value)}
              className="h-9"
              maxLength={50}
              disabled={!!generatedLink}
              onKeyDown={e => e.key === 'Enter' && !generatedLink && generateLink()}
            />

            {!generatedLink ? (
              <Button
                onClick={generateLink}
                disabled={!linkName.trim() || generating}
                className="w-full bg-[#0073ea] hover:bg-[#0060c2] text-white"
              >
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Gerar link de convite
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly className="h-9 text-xs font-mono" />
                  <Button
                    onClick={copyLink}
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Link válido por 72h. Convite associado a <strong>{linkName}</strong>.
                </p>
                <Button onClick={resetLink} variant="ghost" size="sm" className="w-full text-xs">
                  Gerar outro link
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
