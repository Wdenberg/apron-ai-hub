
-- Replace SECURITY DEFINER view with a SECURITY DEFINER function
DROP VIEW IF EXISTS public.stores_public;

CREATE OR REPLACE FUNCTION public.get_public_store(_slug text)
RETURNS TABLE(id uuid, slug text, name text, description text, logo_url text, cover_url text, whatsapp text, address text, city text, state text, hours jsonb, is_open boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.slug, s.name, s.description, s.logo_url, s.cover_url, s.whatsapp, s.address, s.city, s.state, s.hours, s.is_open
  FROM public.stores s WHERE s.slug = _slug;
$$;

-- Lock down EXECUTE on all SECURITY DEFINER functions, then grant only to intended roles.
REVOKE ALL ON FUNCTION public.get_public_store(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store(text) TO anon, authenticated;

-- Trigger / internal helpers — never callable via API
REVOKE ALL ON FUNCTION public.assign_order_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_order_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_customer_on_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_store_payment_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.before_order_item_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.after_order_item_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_store_last_login() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_health(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_payment_on_delivery() FROM PUBLIC, anon, authenticated;

-- has_role: signed-in users only (also used server-side)
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Admin RPCs: authenticated only (internal has_role check enforces admin)
REVOKE ALL ON FUNCTION public.admin_add_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_note(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_create_campaign(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_campaign(text, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_extend_trial(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_invite(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_campaigns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_campaigns() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_stores(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_stores(text, text, text, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_team() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_mark_recipient_opened(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_recipient_opened(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_recovery_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recovery_list() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_register_churn(uuid, churn_reason, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_register_churn(uuid, churn_reason, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_segment_stores(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_segment_stores(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_subscription_status(uuid, subscription_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid, subscription_status, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_store_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_store_detail(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_trial_metrics(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_trial_metrics(integer) TO authenticated;

-- Owner RPCs: authenticated only
REVOKE ALL ON FUNCTION public.my_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_orders() TO authenticated;
REVOKE ALL ON FUNCTION public.list_store_customers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_store_customers(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.list_customer_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_orders(uuid) TO authenticated;

-- Public storefront RPCs: anon + authenticated
REVOKE ALL ON FUNCTION public.list_public_products(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_products(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb, uuid) TO anon, authenticated;
