
-- 1. Drop over-permissive anon policies on orders/order_items and stores
DROP POLICY IF EXISTS orders_public_read_own ON public.orders;
DROP POLICY IF EXISTS orders_public_insert ON public.orders;
DROP POLICY IF EXISTS order_items_public_read ON public.order_items;
DROP POLICY IF EXISTS order_items_public_insert ON public.order_items;
DROP POLICY IF EXISTS stores_public_read ON public.stores;

-- 2. Public safe view for stores (no stripe / subscription / trial fields)
CREATE OR REPLACE VIEW public.stores_public
WITH (security_invoker = true) AS
SELECT id, slug, name, description, logo_url, cover_url,
       whatsapp, address, city, state, hours, is_open
FROM public.stores;

-- Grant anon SELECT on the view + a narrow SELECT policy on stores restricted to safe columns
GRANT SELECT ON public.stores_public TO anon, authenticated;

CREATE POLICY stores_public_safe_read ON public.stores
  FOR SELECT TO anon
  USING (true);
-- The view uses security_invoker so anon SELECT on stores is still required.
-- Anon role only has column-level grants below, so stripe columns stay hidden.
REVOKE SELECT ON public.stores FROM anon;
GRANT SELECT (id, slug, name, description, logo_url, cover_url,
              whatsapp, address, city, state, hours, is_open)
  ON public.stores TO anon;

-- 3. Split stores owner policy so payment fields cannot be changed by owner
DROP POLICY IF EXISTS stores_owner_all ON public.stores;

CREATE POLICY stores_owner_select ON public.stores
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY stores_owner_insert ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY stores_owner_update ON public.stores
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY stores_owner_delete ON public.stores
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Guard trigger blocks changes to billing fields for non-service-role callers
CREATE OR REPLACE FUNCTION public.guard_store_payment_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
  THEN
    RAISE EXCEPTION 'Cannot modify billing fields directly';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_store_payment_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stores_guard_payment ON public.stores;
CREATE TRIGGER stores_guard_payment
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.guard_store_payment_fields();

-- 4. Public order creation via a SECURITY DEFINER RPC that validates everything
CREATE OR REPLACE FUNCTION public.create_public_order(
  _store_id uuid,
  _customer_name text,
  _customer_whatsapp text,
  _notes text,
  _items jsonb
)
RETURNS TABLE(id uuid, order_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_id uuid;
  _order_number integer;
  _item jsonb;
  _product_id uuid;
  _quantity integer;
  _price numeric;
  _store_open boolean;
BEGIN
  -- Validate inputs
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Invalid customer name';
  END IF;
  IF _customer_whatsapp IS NULL OR length(trim(_customer_whatsapp)) < 8 THEN
    RAISE EXCEPTION 'Invalid whatsapp';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Empty cart';
  END IF;
  IF jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'Too many items';
  END IF;

  -- Validate store exists and is open
  SELECT is_open INTO _store_open FROM public.stores WHERE stores.id = _store_id;
  IF _store_open IS NULL THEN
    RAISE EXCEPTION 'Store not found';
  END IF;
  IF NOT _store_open THEN
    RAISE EXCEPTION 'Store is closed';
  END IF;

  -- Create order
  INSERT INTO public.orders (store_id, customer_name, customer_whatsapp, notes, type)
  VALUES (_store_id, trim(_customer_name), trim(_customer_whatsapp),
          NULLIF(trim(coalesce(_notes, '')), ''), 'reserva')
  RETURNING orders.id, orders.order_number INTO _order_id, _order_number;

  -- Insert items with server-side price lookup and store validation
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _product_id := (_item->>'product_id')::uuid;
    _quantity := (_item->>'quantity')::integer;

    IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 999 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    SELECT price INTO _price
    FROM public.products
    WHERE products.id = _product_id
      AND products.store_id = _store_id
      AND products.active = true
      AND products.stock >= _quantity;

    IF _price IS NULL THEN
      RAISE EXCEPTION 'Product % not available', _product_id;
    END IF;

    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
    VALUES (_order_id, _product_id, _quantity, _price);
  END LOOP;

  RETURN QUERY SELECT _order_id, _order_number;
END;
$$;

-- 5. Lock down EXECUTE on all SECURITY DEFINER functions.
-- Trigger functions never need EXECUTE from client roles.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_order_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.after_order_item_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_customer_on_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_order_number(uuid) FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies but callers must have EXECUTE (SECURITY DEFINER still requires it).
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- create_public_order is the only anon-callable definer function
REVOKE ALL ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb) TO anon, authenticated;

-- 6. Harden the price/stock trigger as defense-in-depth: ignore client price, look up server-side
CREATE OR REPLACE FUNCTION public.after_order_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actual_price numeric;
  _order_store uuid;
  _product_store uuid;
BEGIN
  SELECT store_id INTO _order_store FROM public.orders WHERE id = NEW.order_id;
  SELECT price, store_id INTO _actual_price, _product_store
    FROM public.products WHERE id = NEW.product_id;

  IF _actual_price IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  IF _product_store IS DISTINCT FROM _order_store THEN
    RAISE EXCEPTION 'Product does not belong to order store';
  END IF;

  -- Force server-side price
  NEW.unit_price := _actual_price;

  UPDATE public.products
    SET stock = GREATEST(stock - NEW.quantity, 0),
        active = CASE WHEN stock - NEW.quantity <= 0 THEN false ELSE active END
    WHERE id = NEW.product_id;

  UPDATE public.orders
    SET total = total + (NEW.quantity * _actual_price)
    WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$;

-- Note: trigger AFTER INSERT can't modify NEW; change to BEFORE for price override.
DROP TRIGGER IF EXISTS order_items_after_insert ON public.order_items;
DROP TRIGGER IF EXISTS after_order_item_insert ON public.order_items;

CREATE OR REPLACE FUNCTION public.before_order_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actual_price numeric;
  _order_store uuid;
  _product_store uuid;
BEGIN
  SELECT store_id INTO _order_store FROM public.orders WHERE id = NEW.order_id;
  SELECT price, store_id INTO _actual_price, _product_store
    FROM public.products WHERE id = NEW.product_id;

  IF _actual_price IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  IF _product_store IS DISTINCT FROM _order_store THEN
    RAISE EXCEPTION 'Product does not belong to order store';
  END IF;

  NEW.unit_price := _actual_price;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.before_order_item_insert() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER order_items_before_insert
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.before_order_item_insert();

CREATE TRIGGER order_items_after_insert
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.after_order_item_insert();
