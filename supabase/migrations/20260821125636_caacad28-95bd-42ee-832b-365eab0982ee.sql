-- Migration to add project rescheduling support

-- 1. Add columns to boards
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS project_start DATE;
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS project_end DATE;

-- 2. Create schedule_snapshots table
CREATE TABLE IF NOT EXISTS public.schedule_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    payload JSONB NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.schedule_snapshots ENABLE ROW LEVEL SECURITY;

-- 4. Grant access
GRANT SELECT, INSERT ON public.schedule_snapshots TO authenticated;
GRANT ALL ON public.schedule_snapshots TO service_role;

-- 5. Policies
CREATE POLICY "Authenticated users can select all snapshots"
ON public.schedule_snapshots FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own snapshots"
ON public.schedule_snapshots FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);
