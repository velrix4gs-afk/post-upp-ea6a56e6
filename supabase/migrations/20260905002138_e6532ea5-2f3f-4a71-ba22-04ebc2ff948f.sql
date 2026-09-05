DROP POLICY IF EXISTS "posts_select_admin" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_admin" ON public.posts;

CREATE POLICY "posts_select_admin"
ON public.posts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "posts_delete_admin"
ON public.posts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "voice_notes_authenticated_read" ON storage.objects;

CREATE POLICY "voice_notes_participant_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'voice-notes'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.user_id = auth.uid()
        AND cp.chat_id::text = (storage.foldername(name))[2]
    )
  )
);