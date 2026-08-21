
DO $$
DECLARE
    new_placeholder_id UUID;
    v_board_id UUID;
    v_group_id UUID;
    v_admin_id UUID := '6ae62fe8-b853-48de-987a-2e41200f872a';
BEGIN
    INSERT INTO public.placeholder_members (full_name, email, created_by)
    VALUES ('Nathalia Teste', 'nathalia@example.com', v_admin_id)
    RETURNING id INTO new_placeholder_id;

    SELECT b.id, g.id INTO v_board_id, v_group_id
    FROM public.boards b
    JOIN public.task_groups g ON g.board_id = b.id
    LIMIT 1;

    INSERT INTO public.tasks (title, board_id, group_id, assignee, created_by)
    VALUES ('Tarefa Teste Nathalia', v_board_id, v_group_id, new_placeholder_id, v_admin_id);
END $$;
