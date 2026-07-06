
-- 1) Force server-derived customer link: ignore any client-supplied _customer_user_id
CREATE OR REPLACE FUNCTION public.create_public_order(
  _store_id uuid,
  _customer_name text,
  _customer_whatsapp text,
  _notes text,
  _items jsonb,
  _customer_user_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, order_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order_id uuid;
  _order_number integer;
  _item jsonb;
  _product_id uuid;
  _quantity integer;
  _price numeric;
  _store_open boolean;
  _auth_uid uuid;
BEGIN
  -- Server-derived customer link. Ignore client-supplied _customer_user_id
  -- to prevent attaching orders to arbitrary users' histories.
  _auth_uid := auth.uid();

  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Invalid customer name';
  END IF;
  IF _customer_whatsapp IS NULL OR length(regexp_replace(_customer_whatsapp, '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Invalid whatsapp';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Empty cart';
  END IF;
  IF jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'Too many items';
  END IF;

  SELECT is_open INTO _store_open FROM public.stores WHERE stores.id = _store_id;
  IF _store_open IS NULL THEN RAISE EXCEPTION 'Store not found'; END IF;
  IF NOT _store_open THEN RAISE EXCEPTION 'Store is closed'; END IF;

  INSERT INTO public.orders (store_id, customer_name, customer_whatsapp, notes, type, customer_user_id)
  VALUES (_store_id, trim(_customer_name), trim(_customer_whatsapp),
          NULLIF(trim(coalesce(_notes, '')), ''), 'reserva', _auth_uid)
  RETURNING orders.id, orders.order_number INTO _order_id, _order_number;

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

    IF _price IS NULL THEN RAISE EXCEPTION 'Product % not available', _product_id; END IF;

    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
    VALUES (_order_id, _product_id, _quantity, _price);
  END LOOP;

  RETURN QUERY SELECT _order_id, _order_number;
END;
$function$;

-- Drop the older overload (without _customer_user_id) to avoid ambiguity
DROP FUNCTION IF EXISTS public.create_public_order(uuid, text, text, text, jsonb);

REVOKE ALL ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb, uuid) TO anon, authenticated;

-- 2) Tighten table grants: RLS already blocks anon, but remove unused grants for defense in depth
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;
REVOKE ALL ON public.products FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.stores FROM anon;
