
-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to view files
CREATE POLICY "Authenticated can view task attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-attachments');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated can upload task attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated can delete task attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments');
