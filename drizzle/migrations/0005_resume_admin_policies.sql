CREATE POLICY "Admins manage resume" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'resume' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'resume' AND public.has_role(auth.uid(), 'admin'));