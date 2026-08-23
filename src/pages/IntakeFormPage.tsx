import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

interface FormConfig {
  id: string;
  board_id: string;
  title: string;
  description: string;
  target_group_id: string | null;
  enabled: boolean;
}

interface CustomField {
  id: string;
  field_name: string;
  field_type: string;
  field_options: string[];
}

export default function IntakeFormPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [form, setForm] = useState<FormConfig | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('none');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const { data: formData } = await supabase
        .from('intake_forms')
        .select('*')
        .eq('public_token', token)
        .eq('enabled', true)
        .single();

      if (formData) {
        setForm(formData as FormConfig);
        const { data: fieldsData } = await supabase
          .from('custom_fields')
          .select('*')
          .eq('board_id', formData.board_id)
          .order('position');
        if (fieldsData) setFields(fieldsData.map(f => ({ ...f, field_options: f.field_options as any })));
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const handleSubmit = async () => {
    if (!title.trim() || !form) return;

    const taskId = crypto.randomUUID();
    const { error } = await supabase.from('tasks').insert({
      id: taskId,
      title: title.trim(),
      description: description.trim(),
      status: 'not_started',
      priority,
      board_id: form.board_id,
      group_id: form.target_group_id || null,
      subtasks: [],
      attachments: [],
    });

    if (error) {
      toast.error('Erro ao enviar solicitação');
      return;
    }

    // Save custom field values
    const valuesToInsert = Object.entries(fieldValues)
      .filter(([_, v]) => v.trim())
      .map(([fieldId, value]) => ({
        task_id: taskId,
        field_id: fieldId,
        value,
      }));

    if (valuesToInsert.length > 0) {
      await supabase.from('task_custom_values').insert(valuesToInsert);
    }

    setSubmitted(true);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!form) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Formulário não encontrado ou desativado.</div>;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Solicitação Enviada!</h2>
          <p className="text-sm text-muted-foreground">Sua demanda foi registrada com sucesso.</p>
          <Button onClick={() => { setSubmitted(false); setTitle(''); setDescription(''); setPriority('none'); setFieldValues({}); }}>
            Enviar outra
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">{form.title}</h1>
          {form.description && <p className="text-sm text-muted-foreground mt-1">{form.description}</p>}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resumo da solicitação" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes..." rows={4} />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="critical">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {fields.map(field => (
          <div key={field.id}>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{field.field_name}</label>
            {field.field_type === 'text' && (
              <Input value={fieldValues[field.id] || ''} onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} />
            )}
            {field.field_type === 'number' && (
              <Input type="number" value={fieldValues[field.id] || ''} onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} />
            )}
            {field.field_type === 'date' && (
              <Input type="date" value={fieldValues[field.id] || ''} onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))} />
            )}
            {field.field_type === 'select' && (
              <Select value={fieldValues[field.id] || ''} onValueChange={v => setFieldValues(prev => ({ ...prev, [field.id]: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {(field.field_options || []).map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {field.field_type === 'checkbox' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={fieldValues[field.id] === 'true'} onChange={e => setFieldValues(prev => ({ ...prev, [field.id]: e.target.checked ? 'true' : 'false' }))} />
                Sim
              </label>
            )}
            {field.field_type === 'rating' && (
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFieldValues(prev => ({ ...prev, [field.id]: String(n) }))}
                    className={`text-lg ${Number(fieldValues[field.id]) >= n ? 'text-yellow-500' : 'text-muted-foreground/30'}`}
                  >★</button>
                ))}
              </div>
            )}
          </div>
        ))}

        <Button onClick={handleSubmit} disabled={!title.trim()} className="w-full">
          Enviar Solicitação
        </Button>
      </div>
    </div>
  );
}
