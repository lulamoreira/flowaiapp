import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Share2, Copy, Check, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface PublicTimelineDialogProps {
  boardId: string;
  initialEnabled: boolean;
  publicToken: string;
}

export function PublicTimelineDialog({ boardId, initialEnabled, publicToken }: PublicTimelineDialogProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [copied, setCopied] = useState(false);
  const publicUrl = `${window.location.origin}/timeline/public/${publicToken}`;

  const togglePublic = async (checked: boolean) => {
    const { error } = await supabase
      .from('boards')
      .update({ public_timeline_enabled: checked } as any)
      .eq('id', boardId);

    if (error) {
      toast.error('Erro ao atualizar status público');
      return;
    }

    setEnabled(checked);
    toast.success(checked ? 'Linha do tempo pública ativada' : 'Linha do tempo privada');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <Share2 className="h-3.5 w-3.5 mr-1" />
          Compartilhar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Compartilhar Linha do Tempo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="public-timeline" className="flex flex-col gap-1">
              <span>Link Público</span>
              <span className="font-normal text-xs text-muted-foreground">
                Permitir que qualquer pessoa com o link visualize a linha do tempo.
              </span>
            </Label>
            <Switch
              id="public-timeline"
              checked={enabled}
              onCheckedChange={togglePublic}
            />
          </div>

          {enabled && (
            <div className="space-y-3">
              <Label className="text-xs">Link de visualização</Label>
              <div className="flex items-center space-x-2">
                <Input
                  value={publicUrl}
                  readOnly
                  className="h-9 text-xs"
                />
                <Button size="sm" onClick={copyLink} className="h-9">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
