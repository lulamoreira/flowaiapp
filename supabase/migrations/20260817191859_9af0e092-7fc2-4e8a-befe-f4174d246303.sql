-- Add public_token to boards for public timeline access
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS public_timeline_enabled BOOLEAN DEFAULT false;

-- GRANTs
GRANT SELECT ON public.boards TO anon;
GRANT SELECT ON public.task_groups TO anon;
GRANT SELECT ON public.tasks TO anon;

-- RLS for public boards
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public boards are viewable by token') THEN
        CREATE POLICY "Public boards are viewable by token" ON public.boards
          FOR SELECT TO anon
          USING (public_timeline_enabled = true);
    END IF;
END $$;

-- RLS for groups of public boards
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public groups are viewable for public boards') THEN
        CREATE POLICY "Public groups are viewable for public boards" ON public.task_groups
          FOR SELECT TO anon
          USING (
            EXISTS (
              SELECT 1 FROM public.boards
              WHERE boards.id = task_groups.board_id
              AND boards.public_timeline_enabled = true
            )
          );
    END IF;
END $$;

-- RLS for tasks of public boards
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public tasks are viewable for public boards') THEN
        CREATE POLICY "Public tasks are viewable for public boards" ON public.tasks
          FOR SELECT TO anon
          USING (
            EXISTS (
              SELECT 1 FROM public.boards
              WHERE boards.id = tasks.board_id
              AND boards.public_timeline_enabled = true
            )
          );
    END IF;
END $$;
