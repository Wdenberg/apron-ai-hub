-- 1) Backfill: normalize existing customers to digits-only whatsapp, merging duplicates per store.
WITH normalized AS (
  SELECT id, store_id, name, total_orders, last_order_at, created_at,
         regexp_replace(whatsapp, '\D', '', 'g') AS norm_wa,
         whatsapp AS old_wa
  FROM public.customers
),
canonical AS (
  -- pick the oldest row per (store_id, norm_wa) as the survivor
  SELECT DISTINCT ON (store_id, norm_wa)
    id AS keep_id, store_id, norm_wa, name, created_at
  FROM normalized
  ORDER BY store_id, norm_wa, created_at ASC
),
agg AS (
  SELECT c.keep_id,
         SUM(n.total_orders)::int AS sum_orders,
         MAX(n.last_order_at)     AS max_last,
         MIN(n.created_at)        AS min_created
  FROM canonical c
  JOIN normalized n
    ON n.store_id = c.store_id AND n.norm_wa = c.norm_wa
  GROUP BY c.keep_id
)
UPDATE public.customers cu
SET whatsapp      = c.norm_wa,
    total_orders  = agg.sum_orders,
    last_order_at = agg.max_last,
    created_at    = agg.min_created
FROM canonical c
JOIN agg ON agg.keep_id = c.keep_id
WHERE cu.id = c.keep_id;

-- delete the merged duplicates
DELETE FROM public.customers cu
USING (
  SELECT n.id
  FROM (
    SELECT id, store_id, regexp_replace(whatsapp, '\D', '', 'g') AS norm_wa, created_at
    FROM public.customers
  ) n
  JOIN (
    SELECT DISTINCT ON (store_id, norm_wa) id AS keep_id, store_id, norm_wa
    FROM (
      SELECT id, store_id, regexp_replace(whatsapp, '\D', '', 'g') AS norm_wa, created_at
      FROM public.customers
    ) x
    ORDER BY store_id, norm_wa, created_at ASC
  ) k ON k.store_id = n.store_id AND k.norm_wa = n.norm_wa
  WHERE n.id <> k.keep_id
) dup
WHERE cu.id = dup.id;

-- 2) Replace the trigger function so future upserts always use normalized whatsapp
CREATE OR REPLACE FUNCTION public.upsert_customer_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _wa text;
BEGIN
  IF NEW.customer_whatsapp IS NULL OR NEW.customer_whatsapp = '' THEN
    RETURN NEW;
  END IF;

  _wa := regexp_replace(NEW.customer_whatsapp, '\D', '', 'g');
  IF length(_wa) < 10 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.customers (store_id, whatsapp, name, total_orders, last_order_at)
  VALUES (NEW.store_id, _wa, NEW.customer_name, 1, now())
  ON CONFLICT (store_id, whatsapp) DO UPDATE
    SET total_orders = public.customers.total_orders + 1,
        last_order_at = now(),
        name = EXCLUDED.name;

  RETURN NEW;
END;
$$;

-- 3) Ensure the trigger fires on every order type (previous version filtered to 'reserva' only).
DROP TRIGGER IF EXISTS orders_upsert_customer ON public.orders;
CREATE TRIGGER orders_upsert_customer
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.upsert_customer_on_order();

-- 4) RPC for the /clientes page: list a store's customers with order stats.
CREATE OR REPLACE FUNCTION public.list_store_customers(_store_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  whatsapp text,
  total_orders int,
  last_order_at timestamptz,
  created_at timestamptz,
  total_spent numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT c.id, c.name, c.whatsapp, c.total_orders, c.last_order_at, c.created_at,
    COALESCE((
      SELECT SUM(o.total) FROM public.orders o
      WHERE o.store_id = c.store_id
        AND regexp_replace(COALESCE(o.customer_whatsapp,''), '\D', '', 'g') = c.whatsapp
        AND o.status <> 'cancelado'
    ), 0)::numeric AS total_spent
  FROM public.customers c
  WHERE c.store_id = _store_id
  ORDER BY c.last_order_at DESC NULLS LAST, c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_store_customers(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_store_customers(uuid) TO authenticated;

-- 5) RPC to fetch a single customer's order history (owner-only)
CREATE OR REPLACE FUNCTION public.list_customer_orders(_customer_id uuid)
RETURNS TABLE (
  id uuid,
  order_number int,
  status order_status,
  total numeric,
  created_at timestamptz,
  notes text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _store uuid;
  _wa    text;
BEGIN
  SELECT c.store_id, c.whatsapp INTO _store, _wa
  FROM public.customers c WHERE c.id = _customer_id;
  IF _store IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store AND s.owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT o.id, o.order_number, o.status, o.total, o.created_at, o.notes
  FROM public.orders o
  WHERE o.store_id = _store
    AND regexp_replace(COALESCE(o.customer_whatsapp,''), '\D', '', 'g') = _wa
  ORDER BY o.created_at DESC LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.list_customer_orders(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_customer_orders(uuid) TO authenticated;