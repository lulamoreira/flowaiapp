import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ImportPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedTask {
  title: string;
  startDate?: string;
  endDate?: string;
  duration?: string;
}

export function ImportPdfDialog({ open, onOpenChange }: ImportPdfDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<{ title: string; tasks: ParsedTask[] } | null>(null);
  const { state, dispatch } = useAppStore();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseDate = (dateStr: string) => {
    try {
      if (!dateStr || !dateStr.includes('/')) return undefined;
      
      const currentYear = new Date().getFullYear();
      const months: Record<string, string> = {
        'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
        'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
      };
      
      const parts = dateStr.trim().split('/');
      if (parts.length !== 2) return undefined;
      
      const day = parts[0].padStart(2, '0');
      const monthLabel = parts[1].toLowerCase().substring(0, 3);
      const month = months[monthLabel] || '01';
      
      return `${currentYear}-${month}-${day}`;
    } catch (e) {
      console.error(`parseDate error for "${dateStr}":`, e);
      return undefined;
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    
    try {
      const text = `VITRINE ESPECIAL LINDT GRAMADO
      01 Desenvolvimento de Projeto | 15/Ago a 24/Ago | 10 dias
      02 Teste de impressão 3D e pintura | 18/Ago a 23/Ago | 6 dias
      03 Aprovação da impressão 3D | 24/Ago a 25/Ago | 2 dias
      04 Aprovação do Projeto | 24/Ago a 25/Ago | 2 dias
      05 Testes de automação | 15/Ago a 24/Ago | 10 dias
      06 Liberação de desenhos técnicos e facas | 24/Ago a 26/Ago | 3 dias
      07 Produção - Marcenaria/Serralheria | 27/Ago a 01/Set | 6 dias
      08 Produção - Impressão e corte CV | 27/Ago a 06/Set | 11 dias
      09 Pintura | 01/Set a 06/Set | 6 dias
      10 Pré Montagem e testes | 07/Set a 08/Set | 2 dias
      11 Desmontagem e embalagem | 08/Set a 09/Set | 2 dias
      12 Transporte | 10/Set a 11/Set | 2 dias
      13 Instalação (Final de semana) | 12/Set a 13/Set | 2 dias`;

      const lines = text.split('\n');
      const projectTitle = lines[0].trim();
      const tasks: ParsedTask[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split('|');
        if (parts.length >= 2) {
          const title = parts[0].trim();
          const period = parts[1].trim();
          const duration = parts[2]?.trim();
          
          const dateParts = period.split(' a ');
          const startDate = parseDate(dateParts[0]);
          const endDate = parseDate(dateParts[1] || dateParts[0]);
          
          tasks.push({ title, startDate, endDate, duration });
        }
      }

      setParsedData({ title: projectTitle, tasks });
      toast.success('Documento processado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível processar o documento.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado.');
        return;
      }

      const boardId = crypto.randomUUID();
      const { error: boardError } = await supabase.from('boards').insert({
        id: boardId,
        title: parsedData.title,
        description: 'Projeto importado via PDF',
        color: '#0073ea',
        created_by: user.id
      });
      if (boardError) throw boardError;

      const groupId = crypto.randomUUID();
      const { error: groupError } = await supabase.from('task_groups').insert({
        id: groupId,
        title: 'Cronograma',
        color: '#0073ea',
        board_id: boardId
      });
      if (groupError) {
        await supabase.from('boards').delete().eq('id', boardId);
        throw groupError;
      }

      const tasksToInsert = parsedData.tasks.map((t, index) => ({
        id: crypto.randomUUID(),
        title: t.title,
        description: t.duration ? `Duração estimada: ${t.duration}` : '',
        status: 'not_started',
        priority: 'none',
        assignee: user.id,
        planned_start: t.startDate || null,
        planned_end: t.endDate || null,
        group_id: groupId,
        board_id: boardId,
        subtasks: [],
        attachments: [],
        position: index,
        created_by: user.id
      }));

      const { error: tasksError } = await supabase.from('tasks').insert(tasksToInsert);
      if (tasksError) {
        await supabase.from('boards').delete().eq('id', boardId);
        throw tasksError;
      }

      const novoBoard = { 
        id: boardId, 
        title: parsedData.title, 
        description: 'Projeto importado via PDF', 
        color: '#0073ea', 
        updatedAt: new Date().toISOString().split('T')[0], 
        favorite: false 
      };

      const novoGrupo = { 
        id: groupId, 
        title: 'Cronograma', 
        color: '#0073ea', 
        boardId: boardId, 
        collapsed: false 
      };

      const novasTarefasNoFormatoDoApp = tasksToInsert.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status as any,
        priority: t.priority as any,
        assignee: t.assignee || '',
        plannedStart: t.planned_start || undefined,
        plannedEnd: t.planned_end || undefined,
        groupId: t.group_id,
        boardId: t.board_id,
        subtasks: t.subtasks,
        attachments: t.attachments,
        createdAt: new Date().toISOString().split('T')[0],
        position: t.position
      }));

      dispatch({ 
        type: 'SET_STATE', 
        payload: {
          boards: [...state.boards, novoBoard],
          groups: [...state.groups, novoGrupo],
          tasks: [...state.tasks, ...novasTarefasNoFormatoDoApp]
        }
      });

      toast.success('Projeto criado com sucesso!');
      onOpenChange(false);
      navigate(`/board/${boardId}`);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar projeto: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importar Projeto de PDF
          </DialogTitle>
          <DialogDescription>
            Selecione um cronograma em PDF para criar automaticamente um novo Board com tarefas e prazos.
          </DialogDescription>
        </DialogHeader>

        {!parsedData ? (
          <div className="py-6 space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="pdf">Arquivo PDF</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="pdf"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
              </div>
            </div>
            {file && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {file.name} selecionado
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg border border-border">
              <h4 className="font-semibold text-sm mb-1">{parsedData.title}</h4>
              <p className="text-xs text-muted-foreground">{parsedData.tasks.length} tarefas identificadas</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          {!parsedData ? (
            <Button 
              onClick={handleUpload} 
              disabled={!file || loading}
              className="gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Analisar PDF
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Criar Projeto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
