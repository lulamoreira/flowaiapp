-- 1. LIMPE O ESTADO MEIO CONVERTIDO
DO $$
BEGIN
    -- Devolver o provisório ao estado não convertido
    UPDATE public.placeholder_members
    SET claimed_by = NULL,
        claimed_at = NULL
    WHERE id = '737b40f9-d969-4be2-91df-df48999a622f';

    -- Devolver tarefas (usando os UUIDs conhecidos do banco e do provisório)
    UPDATE public.tasks
    SET assignee = '737b40f9-d969-4be2-91df-df48999a622f'
    WHERE title = 'Tarefa Teste Nathalia'
      AND assignee != '737b40f9-d969-4be2-91df-df48999a622f';

    -- Preparar subtarefa para teste de migração de JSONB
    UPDATE public.tasks
    SET subtasks = '[{"id": "sub-Nathalia", "title": "Subtarefa de Teste Nathalia", "completed": false, "assignee": "737b40f9-d969-4be2-91df-df48999a622f"}]'::jsonb
    WHERE id = '89c43a74-f6fa-4f71-b68c-1492803e39d7';
END $$;
