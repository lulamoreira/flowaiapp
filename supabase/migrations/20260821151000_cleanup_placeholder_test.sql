-- 1. LIMPE O ESTADO MEIO CONVERTIDO
DO $$
BEGIN
    -- Devolver o provisório ao estado não convertido
    UPDATE public.placeholder_members
    SET claimed_by = NULL,
        claimed_at = NULL
    WHERE id = '737b40f9-d969-4be2-91df-df48999a622f';

    -- Devolver tarefas que foram migradas erroneamente
    -- O usuário real era 'a69024e4-a127-4b2a-ae33-3b609f162c25'
    -- Identificamos as tarefas que pertenciam a este provisório.
    -- Como a migration anterior só fez UPDATE tasks WHERE assignee = v_placeholder_id,
    -- e esse provisório não existia em outros ambientes, o risco de colisão é baixo.
    UPDATE public.tasks
    SET assignee = '737b40f9-d969-4be2-91df-df48999a622f'
    WHERE assignee = 'a69024e4-a127-4b2a-ae33-3b609f162c25'
      AND board_id IN (SELECT board_id FROM public.tasks WHERE assignee = '737b40f9-d969-4be2-91df-df48999a622f' LIMIT 1);
      
    -- Se não houver tarefas, nada acontece.
END $$;
