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
  /** Numeração da etapa vinda do documento (quando existir). */
  number?: number | null;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  
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
      setErrorMessage(null);
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


  /** Converte um arquivo de imagem em data URL, redimensionando se muito grande. */
  const imageFileToDataUrl = (imgFile: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      reader.onload = () => {
        const src = String(reader.result || '');
        const img = new Image();
        img.onerror = () => reject(new Error('Imagem inválida ou corrompida.'));
        img.onload = () => {
          const MAX = 2000;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          if (scale === 1) {
            resolve(src);
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(src);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.src = src;
      };
      reader.readAsDataURL(imgFile);
    });

  /** Renderiza as páginas de um PDF sem texto em imagens (fallback de OCR pela IA). */
  const renderPdfPagesToImages = async (pdfFile: File, maxPages = 4): Promise<string[]> => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const images: string[] = [];
    const total = Math.min(pdf.numPages, maxPages);
    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.85));
    }
    return images;
  };

  /**
   * Resolve o placeholder "YYYY" usando o ano de início informado.
   * A virada de ano só acontece quando o mês retrocede de forma significativa
   * (ex.: Dez -> Jan). Retrocessos pequenos são normais em cronogramas — tarefas
   * não vêm em ordem cronológica e o fim de uma pode ser posterior ao início da
   * seguinte — e antes causavam saltos indevidos de ano (Set/2026 -> Set/2027).
   */
  const processDates = (tasks: ParsedTask[], startYear: number): ParsedTask[] => {
    let currentYear = startYear;
    let lastMonth = -1;

    return tasks.map(task => {
      const fixDate = (dateStr?: string) => {
        if (!dateStr || !dateStr.includes('YYYY')) return dateStr;

        const monthMatch = dateStr.match(/-(\d{2})-/);
        if (monthMatch) {
          const month = parseInt(monthMatch[1], 10);
          // Só vira o ano em retrocesso grande (Dez -> Jan/Fev...)
          if (lastMonth !== -1 && lastMonth - month >= 6) {
            currentYear++;
          }
          if (month >= lastMonth) lastMonth = month;
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
      const isImage = file.type.startsWith('image/');
      let payload: { text?: string; images?: string[] };

      if (isImage) {
        payload = { images: [await imageFileToDataUrl(file)] };
      } else {
        try {
          payload = { text: await extractTextFromPdf(file) };
        } catch (err: any) {
          // PDF digitalizado: cai para leitura por imagem das páginas
          if (err?.message !== 'OCR_REQUIRED') throw err;
          const images = await renderPdfPagesToImages(file);
          if (images.length === 0) throw err;
          payload = { images };
        }
      }

      const { data, error } = await supabase.functions.invoke('ai-parse-schedule', {
        body: payload
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

      /**
       * A ordem precisa ser exatamente a do documento. Quando a IA devolve a
       * numeração das etapas, ordenamos por ela (fonte de verdade do documento);
       * caso contrário mantemos a ordem de leitura, sem reordenar por data/título.
       */
      const rawTasks: ParsedTask[] = (data?.tasks || []).map((t: any) => ({
        ...t,
        number: Number.isFinite(Number(t?.number)) && Number(t?.number) > 0 ? Number(t.number) : null,
      }));
      if (rawTasks.length > 0 && rawTasks.every((t) => typeof t.number === 'number')) {
        rawTasks.sort((a, b) => (a.number as number) - (b.number as number));
      }
      if (rawTasks.length === 0) {
        const msg = 'Nenhuma tarefa foi identificada neste documento.';
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      const hasMissingYear = rawTasks.some((t: any) => 
        (t.startDate && t.startDate.includes('YYYY')) || 
        (t.endDate && t.endDate.includes('YYYY'))
      );

      setParsedData({
        title: data.title || file.name.replace(/\.(pdf|png|jpe?g|webp|heic)$/i, ''),
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
        ? 'Este PDF é digitalizado e não pôde ser lido. Tente enviar uma imagem (print) do cronograma.'
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

  /**
   * A numeração informada aqui é a fonte de verdade da ordem das tarefas.
   * Campo vazio = sem número (essas tarefas ficam no fim, mantendo a ordem de leitura).
   */
  const handleTaskNumberEdit = (index: number, value: string) => {
    if (!parsedData) return;
    const parsed = parseInt(value, 10);
    const nextNumber = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const newTasks = [...parsedData.tasks];
    newTasks[index] = { ...newTasks[index], number: nextNumber };
    setParsedData({ ...parsedData, tasks: newTasks });
  };

  /** Ordena por numeração (crescente); sem numeração vai para o fim, ordem estável. */
  const sortByNumber = <T extends { number?: number | null }>(items: T[]): T[] =>
    items
      .map((item, i) => ({ item, i }))
      .sort((a, b) => {
        const an = a.item.number ?? null;
        const bn = b.item.number ?? null;
        if (an === bn) return a.i - b.i;
        if (an === null) return 1;
        if (bn === null) return -1;
        return an - bn;
      })
      .map(({ item }) => item);


  const handleConfirm = async () => {
    if (!parsedData) return;
    setLoading(true);

    let boardId: string | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      // Final date processing with user selected year + ordem definida pela numeração
      const finalTasks = sortByNumber(processDates(parsedData.tasks, parseInt(baseYear, 10)));


      boardId = crypto.randomUUID();
      
      // 1. Create Board
      const { error: boardError } = await supabase.from('boards').insert({
        id: boardId,
        title: parsedData.title,
        description: 'Projeto importado por documento',
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
        task_number: t.number ?? index + 1,
        created_by: user.id
      }));

      const { error: tasksError } = await supabase.from('tasks').insert(tasksToInsert);
      if (tasksError) throw tasksError;

      // 4. Update local state
      const novoBoard = { 
        id: boardId, 
        title: parsedData.title, 
        description: 'Projeto importado por documento', 
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
        taskNumber: t.task_number,
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

  /**
   * Datas exibidas na revisão já com o ano resolvido pelo "Ano de Início".
   * Sem isto, tarefas cujo ano veio como placeholder "YYYY" apareceriam vazias,
   * dando a impressão de que a IA não leu as datas presentes na imagem/PDF.
   */
  const previewTasks = React.useMemo(() => {
    if (!parsedData) return [] as Array<{ task: ParsedTask; index: number }>;
    const year = parseInt(baseYear, 10);
    const resolved = Number.isFinite(year) ? processDates(parsedData.tasks, year) : parsedData.tasks;
    const withIndex = resolved.map((task, index) => ({ task, index, number: task.number ?? null }));
    return sortByNumber(withIndex);
  }, [parsedData, baseYear]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importar Cronograma (PDF ou Imagem)
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' 
              ? 'Selecione um PDF ou uma imagem (print, foto) do cronograma para extrair tarefas e datas automaticamente.'
              : 'Revise os dados extraídos antes de criar o projeto.'}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">Falha ao processar o cronograma</p>
              <p className="break-words text-xs opacity-90">{errorMessage}</p>
            </div>
          </div>
        )}



        {step === 'upload' ? (
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/30">
            <Upload className="h-10 w-10 text-muted-foreground mb-4" />
            <div className="text-center px-4">
              <Label htmlFor="pdf-upload" className="cursor-pointer">
                <span className="text-primary font-semibold hover:underline">Clique para selecionar</span> ou arraste o arquivo
                <Input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
              <p className="text-xs text-muted-foreground mt-2">PDF, PNG, JPG ou WEBP. PDFs com texto selecionável têm a melhor precisão.</p>
            </div>
            {file && (
              <div className="mt-6 flex items-center gap-2 bg-background p-2 rounded border border-border">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col gap-4 py-2">
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
              <span>{previewTasks.length} tarefas encontradas</span>
              {previewTasks.some(t => !t.startDate || !t.endDate) && (
                <span className="text-yellow-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Algumas tarefas sem data
                </span>
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0 h-[45vh] border rounded-md">
              <div className="p-4 space-y-4">
                {previewTasks.map((task, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-end border-b border-border/50 pb-4 last:border-0">
                    <div className="col-span-6 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">
                        Tarefa {String(task.number ?? idx + 1).padStart(2, '0')}
                      </Label>

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
                        value={task.startDate?.includes('YYYY') ? '' : (task.startDate || '')} 
                        onChange={(e) => handleTaskEdit(idx, 'startDate', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Fim</Label>
                      <Input 
                        type="date"
                        value={task.endDate?.includes('YYYY') ? '' : (task.endDate || '')} 
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
                Analisar documento
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
