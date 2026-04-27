
-- Set REPLICA IDENTITY FULL so updates/deletes carry full row data
ALTER TABLE public.invitations REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.boards REPLICA IDENTITY FULL;
ALTER TABLE public.task_groups REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
ALTER TABLE public.task_custom_values REPLICA IDENTITY FULL;
ALTER TABLE public.custom_fields REPLICA IDENTITY FULL;
ALTER TABLE public.automation_rules REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;
ALTER TABLE public.custom_functions REPLICA IDENTITY FULL;
ALTER TABLE public.user_custom_functions REPLICA IDENTITY FULL;
ALTER TABLE public.function_permissions REPLICA IDENTITY FULL;

-- Add to realtime publication (idempotent via DO block)
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'invitations','user_roles','profiles','boards','task_groups','tasks',
    'task_comments','task_custom_values','custom_fields','automation_rules',
    'notifications','activity_log','custom_functions','user_custom_functions',
    'function_permissions'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      -- already in publication, skip
      NULL;
    END;
  END LOOP;
END $$;
