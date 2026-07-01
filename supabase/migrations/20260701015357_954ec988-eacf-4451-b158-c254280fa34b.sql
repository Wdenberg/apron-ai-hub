
-- Fix search_path on helper functions
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.next_order_number(UUID) SET search_path = public;

-- Revoke public execute on internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_order_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.after_order_item_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_customer_on_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_order_number(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role should stay callable by authenticated
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;

-- Storage policies for public bucket store-assets: anyone can read, owners can upload/update their files
CREATE POLICY "store_assets_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-assets');
CREATE POLICY "store_assets_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "store_assets_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "store_assets_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
