/*
# EcoSwap — Storage buckets

Creates two public storage buckets:
- `item-photos` — for item listing photos uploaded by users
- `recycling-photos` — for recycling spot report photos

Both are public-read (public URLs) so map pins and feeds can render images
without signed URLs. Writes are restricted to the authenticated owner via RLS
storage policies: a user can only upload/delete within a folder named after
their own auth uid.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('item-photos', 'item-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('recycling-photos', 'recycling-photos', true)
ON CONFLICT (id) DO NOTHING;

-- item-photos policies
DROP POLICY IF EXISTS "item_photos_read_all" ON storage.objects;
CREATE POLICY "item_photos_read_all"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'item-photos');

DROP POLICY IF EXISTS "item_photos_insert_own" ON storage.objects;
CREATE POLICY "item_photos_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'item-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "item_photos_delete_own" ON storage.objects;
CREATE POLICY "item_photos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'item-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- recycling-photos policies
DROP POLICY IF EXISTS "recycling_photos_read_all" ON storage.objects;
CREATE POLICY "recycling_photos_read_all"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'recycling-photos');

DROP POLICY IF EXISTS "recycling_photos_insert_own" ON storage.objects;
CREATE POLICY "recycling_photos_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recycling-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "recycling_photos_delete_own" ON storage.objects;
CREATE POLICY "recycling_photos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'recycling-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
