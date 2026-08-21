import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Users } from 'lucide-react';

interface ProjectMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
}

export function ProjectMembersDialog({ open, onOpenChange, boardId }: ProjectMembersDialogProps) {
  const { state } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [authorizedIds, setAuthorizedIds] = useState<string[]>([]);
  const [initialAuthorizedIds, setInitialAuthorizedIds] = useState<string[]>([]);

  // Load authorized members for this board
  const loadAuthorized = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_members' as any)
        .select('user_id')
        .eq('board_id', boardId);
      
      if (error) throw error;
      const ids = (data as any[])?.map((m: any) => m.user_id) || [];
      setAuthorizedIds(ids);
      setInitialAuthorizedIds(ids);
    } catch (err: any) {
      console.error('Error loading members:', err);
      toast.error('Erro ao carregar membros: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadAuthorized();
    }
  }, [open, boardId]);

  const handleToggle = (userId: string) => {
    setAuthorizedIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const toAdd = authorizedIds.filter(id => !initialAuthorizedIds.includes(id));
      const toRemove = initialAuthorizedIds.filter(id => !authorizedIds.includes(id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('project_members' as any)
          .delete()
          .eq('board_id', boardId)
          .in('user_id', toRemove);
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('project_members' as any)
          .insert(toAdd.map(uid => ({ board_id: boardId, user_id: uid })));
        if (error) throw error;
      }

      toast.success('Membros atualizados com sucesso');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving members:', err);
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Autorização de Acesso ao Projeto
          </DialogTitle>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground mt-2">
          Selecione os colaboradores que têm permissão para visualizar e interagir com este projeto.
        </p>

        <ScrollArea className="h-[300px] mt-4 border rounded-md p-2">
          {loading && !authorizedIds.length ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {state.users
                .filter(u => !u.isPlaceholder) // Somente usuários reais podem ser autorizados explicitamente
                .map((user) => (
                <div key={user.id} className="flex items-center space-x-3 p-2 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer" onClick={(e) => {
                  e.preventDefault();
                  handleToggle(user.id);
                }}>
                  <Checkbox 
                    id={`user-${user.id}`} 
                    checked={authorizedIds.includes(user.id)}
                    readOnly // Managed by parent div click to avoid double toggle
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{user.email || 'Sem email'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="bg-primary">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
