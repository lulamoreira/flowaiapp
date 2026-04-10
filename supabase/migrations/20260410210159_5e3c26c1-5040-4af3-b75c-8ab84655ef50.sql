
-- Custom fields per board
CREATE TABLE public.custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  field_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view custom fields" ON public.custom_fields FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create custom fields" ON public.custom_fields FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update custom fields" ON public.custom_fields FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete custom fields" ON public.custom_fields FOR DELETE TO authenticated USING (true);

-- Task custom field values
CREATE TABLE public.task_custom_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, field_id)
);

ALTER TABLE public.task_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task custom values" ON public.task_custom_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create task custom values" ON public.task_custom_values FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update task custom values" ON public.task_custom_values FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete task custom values" ON public.task_custom_values FOR DELETE TO authenticated USING (true);

-- Public intake forms config
CREATE TABLE public.intake_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Formulário de Solicitação',
  description TEXT NOT NULL DEFAULT '',
  target_group_id UUID REFERENCES public.task_groups(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  public_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(board_id)
);

ALTER TABLE public.intake_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view intake forms" ON public.intake_forms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage intake forms" ON public.intake_forms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update intake forms" ON public.intake_forms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anon can view enabled forms by token" ON public.intake_forms FOR SELECT TO anon USING (enabled = true);

-- Allow anon to insert tasks via public forms
CREATE POLICY "Anon can create tasks via forms" ON public.tasks FOR INSERT TO anon WITH CHECK (true);
