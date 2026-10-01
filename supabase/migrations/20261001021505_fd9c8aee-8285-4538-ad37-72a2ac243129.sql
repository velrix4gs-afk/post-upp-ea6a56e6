DROP POLICY IF EXISTS "Post images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view posts bucket" ON storage.objects;
DROP POLICY IF EXISTS "Group images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view stories" ON storage.objects;
DROP POLICY IF EXISTS "Cover images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view covers" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view reels" ON storage.objects;

CREATE POLICY "Owners can list their public media files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('posts','group-images','stories','covers','avatars','reels')
  AND owner_id = (select auth.uid()::text)
);