-- 1) Extend payment_method enum with new options
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'cartao_debito';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'cartao_credito';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'transferencia';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'outro';

-- 2) create_quick_sale: registers a presencial sale atomically
CREATE OR REPLACE FUNCTION public.create_quick_sale(
  _store_id uuid,
  _customer_name text,
  _customer_whatsapp text,
  _product_id uuid,
  _quantity integer,
  _payment public.payment_method,
  _notes text DEFAULT NULL
)
RETURNS TABLE(id uuid, order_number integer, total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_id uuid;
  _order_number integer;
  _price numeric;
  _stock integer;
  _product_store uuid;
  _total numeric;
BEGIN
  -- Only the store owner can create quick sales for their store
  IF NOT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id AND s.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Invalid customer name';
  END IF;
  IF _customer_whatsapp IS NULL
     OR length(regexp_replace(_customer_whatsapp, '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Invalid whatsapp';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 999 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  SELECT p.price, p.stock, p.store_id
    INTO _price, _stock, _product_store
    FROM public.products p
   WHERE p.id = _product_id AND p.active = true;

  IF _price IS NULL THEN
    RAISE EXCEPTION 'Product not available';
  END IF;
  IF _product_store IS DISTINCT FROM _store_id THEN
    RAISE EXCEPTION 'Product does not belong to store';
  END IF;
  IF _stock < _quantity THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  _total := _price * _quantity;

  INSERT INTO public.orders (
    store_id, customer_name, customer_whatsapp, notes,
    type, status, payment_status, payment, customer_user_id
  )
  VALUES (
    _store_id, trim(_customer_name), trim(_customer_whatsapp),
    NULLIF(trim(coalesce(_notes, '')), ''),
    'presencial', 'entregue', 'pago', _payment, NULL
  )
  RETURNING orders.id, orders.order_number INTO _order_id, _order_number;

  -- Trigger before/after_order_item_insert will force unit_price,
  -- decrement stock, and add the line to orders.total.
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
  VALUES (_order_id, _product_id, _quantity, _price);

  RETURN QUERY SELECT _order_id, _order_number, _total;
END;
$$;

REVOKE ALL ON FUNCTION public.create_quick_sale(uuid, text, text, uuid, integer, public.payment_method, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_quick_sale(uuid, text, text, uuid, integer, public.payment_method, text) TO authenticated;