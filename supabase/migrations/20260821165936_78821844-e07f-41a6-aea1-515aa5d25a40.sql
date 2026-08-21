ALTER TABLE public.deletion_log ADD COLUMN IF NOT EXISTS confirm_details JSONB;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'deletion_log' AND policyname = 'Coordinators can view deletions'
    ) THEN
        CREATE POLICY "Coordinators can view deletions"
        ON public.deletion_log
        FOR SELECT
        TO authenticated
        USING (
            public.has_role(auth.uid(), 'coordinator')
        );
    END IF;
END $$;