
-- Owners manage files under a folder named after their store id
CREATE POLICY "Owners upload store-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-assets'
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id::text = (storage.foldername(name))[1] AND s.owner_id = auth.uid())
);

CREATE POLICY "Owners update store-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'store-assets'
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id::text = (storage.foldername(name))[1] AND s.owner_id = auth.uid())
);

CREATE POLICY "Owners delete store-assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'store-assets'
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id::text = (storage.foldername(name))[1] AND s.owner_id = auth.uid())
);

-- Anyone can read (needed for signed URLs from anon on the public storefront)
CREATE POLICY "Public read store-assets"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'store-assets');
