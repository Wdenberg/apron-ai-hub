
-- =============================================================
-- 1) Fix: billing/Stripe columns on stores exposed to anon
-- =============================================================
-- Drop the permissive anon SELECT policy on stores. The stores_public
-- view already exposes only safe columns and (as a normal view owned
-- by postgres) bypasses RLS on the underlying table.
DROP POLICY IF EXISTS stores_public_safe_read ON public.stores;

-- Ensure the safe view is readable by anonymous and signed-in visitors.
GRANT SELECT ON public.stores_public TO anon, authenticated;

-- =============================================================
-- 2) Fix: products enumeration across all stores by anon
-- =============================================================
-- Remove the flat "any active product" anon SELECT policy.
DROP POLICY IF EXISTS products_public_read ON public.products;

-- Dedicated RPC: public catalog for one store, identified by slug.
CREATE OR REPLACE FUNCTION public.list_public_products(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  stock integer,
  category text,
  photo_url text,
  store_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.description, p.price, p.stock, p.category, p.photo_url, p.store_id
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE s.slug = _slug
    AND p.active = true
  ORDER BY p.category NULLS LAST, p.name;
$$;

-- =============================================================
-- 3) Fix: SECURITY DEFINER functions executable by PUBLIC
-- =============================================================
-- Revoke the default PUBLIC EXECUTE, then grant only where needed.
-- Trigger functions receive no explicit grants (triggers run as table
-- owner and do not need role-level EXECUTE).

-- Trigger / internal helpers: no direct execute
REVOKE ALL ON FUNCTION public.assign_order_number()               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at()                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_customer_on_order()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.before_order_item_insert()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.after_order_item_insert()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_store_payment_fields()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_store_last_login()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_order_number(uuid)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.store_health(uuid)                  FROM PUBLIC, anon, authenticated;

-- has_role: needed by RLS policy evaluation for both anon/authenticated
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

-- Public storefront helpers
REVOKE ALL ON FUNCTION public.list_public_products(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_products(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb, uuid) TO anon, authenticated;

-- Signed-in customer surface
REVOKE ALL ON FUNCTION public.my_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_orders() TO authenticated;

-- Admin surface (each function checks has_role internally)
REVOKE ALL ON FUNCTION public.admin_extend_trial(uuid, integer)                     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer)                 TO authenticated;

REVOKE ALL ON FUNCTION public.admin_add_note(uuid, text)                            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_add_note(uuid, text)                        TO authenticated;

REVOKE ALL ON FUNCTION public.admin_overview()                                      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_overview()                                  TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_stores(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_stores(text, text, text, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_store_detail(uuid)                              FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_store_detail(uuid)                          TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_subscription_status(uuid, public.subscription_status, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid, public.subscription_status, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_register_churn(uuid, public.churn_reason, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_register_churn(uuid, public.churn_reason, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_invite(text)                                    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_invite(text)                                TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_team()                                     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_team()                                 TO authenticated;

REVOKE ALL ON FUNCTION public.admin_trial_metrics(integer)                          FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_trial_metrics(integer)                      TO authenticated;

REVOKE ALL ON FUNCTION public.admin_recovery_list()                                 FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_recovery_list()                             TO authenticated;

REVOKE ALL ON FUNCTION public.admin_mark_recipient_opened(uuid)                     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_mark_recipient_opened(uuid)                 TO authenticated;

REVOKE ALL ON FUNCTION public.admin_segment_stores(text)                            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_segment_stores(text)                        TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_campaigns()                                FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_list_campaigns()                            TO authenticated;

REVOKE ALL ON FUNCTION public.admin_create_campaign(text, text, jsonb)              FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_create_campaign(text, text, jsonb)          TO authenticated;
