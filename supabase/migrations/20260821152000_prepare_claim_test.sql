-- 1. Reset placeholder state
UPDATE public.placeholder_members
SET claimed_by = NULL,
    claimed_at = NULL
WHERE id = '737b40f9-d969-4be2-91df-df48999a622f';

-- 2. Restore task and add subtask
UPDATE public.tasks
SET assignee = '737b40f9-d969-4be2-91df-df48999a622f',
    subtasks = '[{"id": "sub- Nathalia", "title": "Subtarefa de Teste Nathalia", "completed": false, "assignee": "737b40f9-d969-4be2-91df-df48999a622f"}]'::jsonb
WHERE id = '89c43a74-f6fa-4f71-b68c-1492803e39d7';

-- 3. Ensure target user has the correct role for testing notifications
-- User: a69024e4-a127-4b2a-ae33-3b609f162c25 (lula1973@gmail.com)
INSERT INTO public.user_roles (user_id, role)
SELECT 'a69024e4-a127-4b2a-ae33-3b609f162c25', 'user'
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = 'a69024e4-a127-4b2a-ae33-3b609f162c25' AND role = 'user');
