
-- Migrate existing due_date data to new columns
ALTER TABLE public.tasks
  ADD COLUMN planned_start timestamptz DEFAULT NULL,
  ADD COLUMN planned_end timestamptz DEFAULT NULL,
  ADD COLUMN actual_start timestamptz DEFAULT NULL,
  ADD COLUMN actual_end timestamptz DEFAULT NULL;

-- Copy existing due_date values to planned_end
UPDATE public.tasks SET planned_end = due_date::timestamptz WHERE due_date IS NOT NULL;

-- Copy existing completed_at to actual_end
UPDATE public.tasks SET actual_end = completed_at WHERE completed_at IS NOT NULL;

-- Drop old columns
ALTER TABLE public.tasks DROP COLUMN due_date;
ALTER TABLE public.tasks DROP COLUMN completed_at;
