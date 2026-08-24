-- Remover policies antigas permissivas (qualquer autenticado)
DROP POLICY IF EXISTS "Authenticated can view task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete task attachments" ON storage.objects;

-- Recriar policies restritivas (idempotente)
DROP POLICY IF EXISTS task_attachments_select ON storage.objects;
CREATE POLICY task_attachments_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.can_access_task_by_id(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS task_attachments_insert ON storage.objects;
CREATE POLICY task_attachments_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.can_access_task_by_id(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS task_attachments_delete ON storage.objects;
CREATE POLICY task_attachments_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  AND public.can_access_task_by_id(((storage.foldername(name))[1])::uuid, auth.uid())
);