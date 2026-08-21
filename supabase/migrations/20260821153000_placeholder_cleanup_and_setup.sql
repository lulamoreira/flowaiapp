-- 1. LIMPE O ESTADO MEIO CONVERTIDO
DO $$
BEGIN
    -- Devolver o provisório ao estado não convertido
    UPDATE public.placeholder_members
    SET claimed_by = NULL,
        claimed_at = NULL
    WHERE id = '737b40f9-d969-4be2-91df-df48999a622f';

    -- Devolver tarefas que foram migradas erroneamente (UUID fixo usado na migration neutralizada)
    -- O usuário real era 'a69024e4-a127-4b2a-ae33-3b609f162c25'
    UPDATE public.tasks
    SET assignee = '737b40f9-d969-4be2-91df-df48999a622f'
    WHERE assignee = 'a69024e4-a127-4b2a-ae33-3b609f162c25'
      AND title = 'Tarefa Teste Nathalia';

    -- 3. TESTE A FUNÇÃO DE VERDADE: Preparar subtarefa
    -- A migração do JSONB de subtarefas é a parte mais frágil.
    UPDATE public.tasks
    SET subtasks = '[{"id": "sub- Nathalia", "title": "Subtarefa de Teste Nathalia", "completed": false, "assignee": "737b40f9-d969-4be2-91df-df48999a622f"}]'::jsonb
    WHERE id = '89c43a74-f6fa-4f71-b68c-1492803e39d7';
END $$;
