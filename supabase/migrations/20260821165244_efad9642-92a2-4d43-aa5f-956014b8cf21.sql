-- migration for deletion_log and automatic cleanup

CREATE TABLE public.deletion_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    original_id uuid NOT NULL,
    data jsonb NOT NULL,
    deleted_at timestamptz DEFAULT now() NOT NULL,
    deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    board_id uuid -- helpful for RLS and filtering
);

-- Grant access
GRANT SELECT, INSERT ON public.deletion_log TO authenticated;
GRANT ALL ON public.deletion_log TO service_role;

-- Enable RLS
ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own deletions or admins can view all"
ON public.deletion_log
FOR SELECT
TO authenticated
USING (
    auth.uid() = deleted_by 
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
);

-- Note: No update policy needed, records are immutable until permanent deletion

-- Automatic Cleanup Function (removes records older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_deletions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.deletion_log
    WHERE deleted_at < now() - INTERVAL '24 hours';
END;
$$;
