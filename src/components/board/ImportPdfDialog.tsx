import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Upload, Loader2, CheckCircle2, AlertTriangle, Calendar as CalendarIcon, Edit3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import * as pdfjs from 'pdfjs-dist';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO, addYears } from 'date-fns';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [parsedData, setParsedData] = useState<{ title: string; tasks: ParsedTask[] } | null>(null);
  const [baseYear, setBaseYear] = useState(new Date().getFullYear().toString());
  const [showYearInput, setShowYearInput] = useState(false);
  
  const { state, dispatch } = useAppStore();
  const navigate = useNavigate();

  // Clean up when dialog closes
  useEffect(() => {
    if (!open) {
      setFile(null);
      setParsedData(null);
      setStep('upload');
      setLoading(false);
      setShowYearInput(false);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      fullText += pageText + "\n";
    }
    
    if (!fullText.trim()) {
      throw new Error("OCR_REQUIRED");
    }
    
    return fullText;
  };

  const processDates = (tasks: ParsedTask[], startYear: number): ParsedTask[] => {
    let currentYear = startYear;
    let lastMonth = -1;

    return tasks.map(task => {
      const fixDate = (dateStr?: string) => {
        if (!dateStr || !dateStr.includes('YYYY')) return dateStr;
        
        const monthMatch = dateStr.match(/-(\d{2})-/);
        if (monthMatch) {
          const month = parseInt(monthMatch[1], 10);
          // If month regresses (e.g., Dec -> Jan), increment year
          if (lastMonth !== -1 && month < lastMonth) {
            currentYear++;
          }
          lastMonth = month;
          return dateStr.replace('YYYY', currentYear.toString());
        }
        return dateStr.replace('YYYY', currentYear.toString());
      };

      return {
        ...task,
        startDate: fixDate(task.startDate),
        endDate: fixDate(task.endDate)
      };
    });
  };

  /**
   * Extrai a mensagem real de erro devolvida por uma Edge Function.
   * O supabase-js embrulha respostas não-2xx em FunctionsHttpError, cujo corpo
   * só é acessível através de `error.context` (um Response). Sem isto o usuário
   * receberia apenas "Edge Function returned a non-2xx status code".
   */
  const extractFunctionError = async (error: any): Promise<string> => {
    try {
      const ctx = error?.context;
      if (ctx && typeof ctx.text === 'function') {
        const raw = await ctx.text();
        try {
          const parsed = JSON.parse(raw);
          return parsed?.error || parsed?.message || raw;
        } catch {
          return raw || error.message;
        }
      }
    } catch {
      /* cai no fallback abaixo */
    }
    return error?.message || 'Erro desconhecido ao chamar a IA.';
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const extractedText = await extractTextFromPdf(file);

      const { data, error } = await supabase.functions.invoke('ai-parse-schedule', {
        body: { text: extractedText }
      });

      if (error) {
        const detail = await extractFunctionError(error);
        setErrorMessage(detail);
        toast.error(detail);
        return;
      }

      if (data?.error) {
        setErrorMessage(data.error);
        toast.error(data.error);
        return;
      }

      const rawTasks = data?.tasks || [];
      if (rawTasks.length === 0) {
        const msg = 'Nenhuma tarefa foi identificada neste PDF.';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      const hasMissingYear = rawTasks.some((t: any) => 
        (t.startDate && t.startDate.includes('YYYY')) || 
        (t.endDate && t.endDate.includes('YYYY'))
      );

      setParsedData({
        title: data.title || file.name.replace('.pdf', ''),
        tasks: rawTasks
      });
      
      if (hasMissingYear) {
        setShowYearInput(true);
      }
      
      setStep('review');
      toast.success('Documento analisado com sucesso!');
    } catch (error: any) {
      console.error(error);
      const msg = error?.message === 'OCR_REQUIRED'
        ? 'Este PDF parece ser digitalizado e não contém texto selecionável.'
        : (error?.message || 'Não foi possível processar o documento.');
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };


  const handleTaskEdit = (index: number, field: keyof ParsedTask, value: string) => {
    if (!parsedData) return;
    const newTasks = [...parsedData.tasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setParsedData({ ...parsedData, tasks: newTasks });
  };

  const handleConfirm = async () => {
    if (!parsedData) return;
    setLoading(true);

    let boardId: string | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Final date processing with user selected year
      const finalTasks = processDates(parsedData.tasks, parseInt(baseYear, 10));

      boardId = crypto.randomUUID();
      
      // 1. Create Board
      const { error: boardError } = await supabase.from('boards').insert({
        id: boardId,
        title: parsedData.title,
        description: 'Projeto importado via PDF',
        color: '#3B82F6', // Using semantic blue
        created_by: user.id
      });
      if (boardError) throw boardError;

      // 2. Create Group
      const groupId = crypto.randomUUID();
      const { error: groupError } = await supabase.from('task_groups').insert({
        id: groupId,
        title: 'Cronograma Importado',
        color: '#3B82F6',
        board_id: boardId
      });
      if (groupError) throw groupError;

      // 3. Create Tasks
      const tasksToInsert = finalTasks.map((t, index) => ({
        id: crypto.randomUUID(),
        title: t.title,
        description: t.duration ? `Duração original: ${t.duration}` : '',
        status: 'not_started',
        priority: 'none',
        assignee: user.id,
        planned_start: t.startDate || null,
        planned_end: t.endDate || null,
        group_id: groupId,
        board_id: boardId,
        position: index,
        created_by: user.id
      }));

      const { error: tasksError } = await supabase.from('tasks').insert(tasksToInsert);
      if (tasksError) throw tasksError;

      // 4. Update local state
      const novoBoard = { 
        id: boardId, 
        title: parsedData.title, 
        description: 'Projeto importado via PDF', 
        color: '#3B82F6', 
        updatedAt: new Date().toISOString().split('T')[0], 
        favorite: false 
      };

      const novoGrupo = { 
        id: groupId, 
        title: 'Cronograma Importado', 
        color: '#3B82F6', 
        boardId: boardId, 
        collapsed: false 
      };

      const novasTarefas = tasksToInsert.map(t => ({
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
        subtasks: [],
        attachments: [],
        createdAt: new Date().toISOString().split('T')[0],
        position: t.position
      }));

      dispatch({ 
        type: 'SET_STATE', 
        payload: {
          boards: [...state.boards, novoBoard],
          groups: [...state.groups, novoGrupo],
          tasks: [...state.tasks, ...novasTarefas]
        }
      });

      toast.success('Projeto criado com sucesso!');
      onOpenChange(false);
      navigate(`/board/${boardId}`);
    } catch (err: any) {
      console.error(err);
      // Rollback if board was created
      if (boardId) {
        await supabase.from('boards').delete().eq('id', boardId);
      }
      toast.error('Erro ao salvar projeto: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importar Cronograma (PDF)
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' 
              ? 'Selecione um arquivo PDF para extrair as tarefas e datas automaticamente.'
              : 'Revise os dados extraídos antes de criar o projeto.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/30">
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <div className="text-center px-4">
              <Label htmlFor="pdf-upload" className="cursor-pointer">
                <span className="text-primary font-semibold hover:underline">Clique para selecionar</span> ou arraste o PDF
                <Input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
              <p className="text-xs text-muted-foreground mt-2">PDFs com texto selecionável são recomendados.</p>
            </div>
            {file && (
              <div className="mt-6 flex items-center gap-2 bg-background p-2 rounded border border-border">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Título do Projeto</Label>
                <Input 
                  value={parsedData?.title} 
                  onChange={(e) => setParsedData(prev => prev ? {...prev, title: e.target.value} : null)}
                  className="h-9"
                />
              </div>
              {showYearInput && (
                <div className="space-y-1">
                  <Label className="text-xs">Ano de Início</Label>
                  <Input 
                    type="number" 
                    value={baseYear} 
                    onChange={(e) => setBaseYear(e.target.value)}
                    className="h-9"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{parsedData?.tasks.length} tarefas encontradas</span>
              {parsedData?.tasks.some(t => !t.startDate || !t.endDate) && (
                <span className="text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Algumas tarefas sem data
                </span>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <div className="p-4 space-y-4">
                {parsedData?.tasks.map((task, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-end border-b border-border/50 pb-4 last:border-0">
                    <div className="col-span-6 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Tarefa</Label>
                      <Input 
                        value={task.title} 
                        onChange={(e) => handleTaskEdit(idx, 'title', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Início</Label>
                      <Input 
                        type="date"
                        value={task.startDate?.includes('YYYY') ? '' : task.startDate} 
                        onChange={(e) => handleTaskEdit(idx, 'startDate', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Fim</Label>
                      <Input 
                        type="date"
                        value={task.endDate?.includes('YYYY') ? '' : task.endDate} 
                        onChange={(e) => handleTaskEdit(idx, 'endDate', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="mt-4">
          {step === 'upload' ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleAnalyze} disabled={!file || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Analisar PDF
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep('upload')} disabled={loading}>
                Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={loading} className="bg-primary hover:bg-primary/90">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar e Criar Projeto
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
