GRANT SELECT ON public.stores_public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_products(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb) TO anon, authenticated;