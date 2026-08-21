DO $$
DECLARE
    new_group_id UUID := gen_random_uuid();
    v_board_id UUID := '4a80c245-849e-4cc0-8d71-f79aed30dbc5';
BEGIN
    -- 1. Criar o grupo 'Cronograma'
    INSERT INTO public.task_groups (id, title, color, board_id, position)
    VALUES (new_group_id, 'Cronograma', '#0073ea', v_board_id, 0);

    -- 2. Reassociar tarefas órfãs desse board ao novo grupo
    UPDATE public.tasks
    SET group_id = new_group_id
    WHERE board_id = v_board_id AND group_id IS NULL;
END $$;