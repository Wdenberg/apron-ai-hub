
-- Remove buggy / conflicting policies that referenced the wrong column
-- ("s.name" instead of the object's own name) and the ones that assumed the
-- top folder is the user id instead of the store id.
DROP POLICY IF EXISTS "Owners upload store-assets"  ON storage.objects;
DROP POLICY IF EXISTS "Owners update store-assets"  ON storage.objects;
DROP POLICY IF EXISTS "Owners delete store-assets"  ON storage.objects;
DROP POLICY IF EXISTS store_assets_owner_insert     ON storage.objects;
DROP POLICY IF EXISTS store_assets_owner_update     ON storage.objects;
DROP POLICY IF EXISTS store_assets_owner_delete     ON storage.objects;

-- New correct policies: path is `{store_id}/...` and the caller must own that store.
CREATE POLICY store_assets_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] <> 'avatars'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id::text = (storage.foldername(storage.objects.name))[1]
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY store_assets_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] <> 'avatars'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id::text = (storage.foldername(storage.objects.name))[1]
        AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY store_assets_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND (storage.foldername(name))[1] <> 'avatars'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id::text = (storage.foldername(storage.objects.name))[1]
        AND s.owner_id = auth.uid()
    )
  );
