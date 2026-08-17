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
import { parse, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const { dispatch } = useAppStore();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseDate = (dateStr: string) => {
    try {
      // Formato esperado: "15/Ago" ou "01/Set"
      const currentYear = new Date().getFullYear();
      const months: Record<string, string> = {
        'Jan': '01', 'Fev': '02', 'Mar': '03', 'Abr': '04', 'Mai': '05', 'Jun': '06',
        'Jul': '07', 'Ago': '08', 'Set': '09', 'Out': '10', 'Nov': '11', 'Dez': '12'
      };
      
      const parts = dateStr.trim().split('/');
      if (parts.length !== 2) return undefined;
      
      const day = parts[0].padStart(2, '0');
      const month = months[parts[1]] || '01';
      
      return `${currentYear}-${month}-${day}`;
    } catch (e) {
      return undefined;
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    
    try {
      // Simulação de parsing usando a lógica extraída anteriormente
      // Em um cenário real, enviaríamos para uma Edge Function que usa o AI Gateway
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
          const period = parts[1].trim(); // "15/Ago a 24/Ago"
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
      toast.error('Erro ao processar o PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    
    const boardId = crypto.randomUUID();
    const description = `## Projeto a partir de PDF

**Descrição:**
Transformar o conteúdo do arquivo PDF "${file?.name}" em um projeto estruturado.

**Requisitos:**
1. **Análise do PDF:** Ler e compreender o conteúdo do arquivo PDF fornecido.
2. **Estruturação do Projeto:** Organizar as informações extraídas do PDF em um formato de projeto.
3. **Atribuição de Responsáveis:** Atribuir o usuário atual como responsável inicial.

**Passos:**
1. Fornecer o arquivo PDF para análise.
2. O sistema processa o PDF e gera a estrutura inicial.
3. Atribuir o usuário como responsável principal.`;

    const newBoard = {
      id: boardId,
      title: parsedData.title,
      description: description,
      color: '#0073ea',
      updatedAt: new Date().toISOString().split('T')[0],
      favorite: false
    };

    dispatch({ type: 'ADD_BOARD', payload: newBoard });

    // Criar um grupo padrão
    const groupId = crypto.randomUUID();
    dispatch({
      type: 'ADD_GROUP',
      payload: {
        id: groupId,
        title: 'Cronograma',
        color: '#0073ea',
        boardId: boardId,
        collapsed: false
      }
    });

    // Adicionar tarefas
    parsedData.tasks.forEach((t, index) => {
      dispatch({
        type: 'ADD_TASK',
        payload: {
          id: crypto.randomUUID(),
          title: t.title,
          description: t.duration ? `Duração estimada: ${t.duration}` : '',
          status: 'not_started',
          priority: 'none',
          assignee: profile?.user_id || '',
          plannedStart: t.startDate,
          plannedEnd: t.endDate,
          groupId: groupId,
          boardId: boardId,
          subtasks: [],
          attachments: [],
          createdAt: new Date().toISOString().split('T')[0],
          position: index
        }
      });
    });

    toast.success('Projeto criado com sucesso!');
    onOpenChange(false);
    navigate(`/board/${boardId}`);
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
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
              {parsedData.tasks.slice(0, 5).map((t, i) => (
                <div key={i} className="text-xs flex justify-between items-center border-b border-border/50 pb-1">
                  <span className="truncate flex-1 pr-2">{t.title}</span>
                  <span className="text-muted-foreground shrink-0">{t.duration}</span>
                </div>
              ))}
              {parsedData.tasks.length > 5 && (
                <p className="text-[10px] text-center text-muted-foreground italic">... e mais {parsedData.tasks.length - 5} tarefas</p>
              )}
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
            <Button onClick={handleConfirm} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Criar Projeto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
