import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Check, Link2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInviteSent?: () => void;
}

type AppRole = 'admin' | 'coordinator' | 'user' | 'viewer';

export function InviteDialog({ open, onOpenChange, onInviteSent }: InviteDialogProps) {
  const { user } = useAuth();
  
  // State
  const [invitedName, setInvitedName] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [invitedRole, setInvitedRole] = useState<AppRole>('viewer');
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    if (!user) return;
    
    setGenerating(true);
    try {
      const { data, error } = await supabase
        .from('invitations')
        .insert({ 
          invited_name: invitedName.trim() || null, 
          invited_by: user.id, 
          email: invitedEmail.trim() || null,
          role: invitedRole
        })
        .select('token')
        .single();

      if (error) throw error;

      const isPreview = window.location.hostname.includes('lovable.app');
      const baseUrl = isPreview ? window.location.origin : 'https://flowaiapp.lovable.app';
      const link = `${baseUrl}/register?token=${data.token}`;
      
      setGeneratedLink(link);
      toast.success('Convite gerado com sucesso!');
      if (onInviteSent) onInviteSent();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar convite');
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
    setInvitedName('');
    setInvitedEmail('');
    setInvitedRole('viewer');
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetLink(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar para a Equipe</DialogTitle>
        </DialogHeader>
        
        {!generatedLink ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="inv-name">Nome do Convidado (opcional)</Label>
              <Input
                id="inv-name"
                placeholder="Ex: João Silva"
                value={invitedName}
                onChange={e => setInvitedName(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inv-email">E-mail do Convidado (opcional)</Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="email@exemplo.com"
                value={invitedEmail}
                onChange={e => setInvitedEmail(e.target.value)}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                Se informado, apenas este e-mail poderá aceitar o convite.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Papel no Sistema</Label>
              <Select value={invitedRole} onValueChange={(v: AppRole) => setInvitedRole(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="coordinator">Coordenador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={generateLink}
              disabled={generating}
              className="w-full bg-primary hover:bg-primary/90 text-white mt-2"
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
              Gerar Link de Convite
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 border border-primary/20 rounded-xl space-y-3">
              <p className="text-sm font-medium text-center">Convite pronto!</p>
              <div className="flex gap-2">
                <Input value={generatedLink} readOnly className="h-9 text-xs font-mono bg-background" />
                <Button
                  onClick={copyLink}
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Este link expira em 72 horas e concede acesso como <strong>{invitedRole}</strong>.
              </p>
            </div>
            <Button onClick={resetLink} variant="ghost" size="sm" className="w-full text-xs">
              Criar outro convite
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

