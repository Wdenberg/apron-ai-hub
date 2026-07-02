
-- 1. Enum tweaks
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

-- 2. New columns
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_user_id uuid NULL;

CREATE INDEX IF NOT EXISTS orders_customer_user_id_idx ON public.orders(customer_user_id);

-- Customer can read their own orders / items
CREATE POLICY orders_customer_read_own ON public.orders
  FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

CREATE POLICY order_items_customer_read_own ON public.order_items
  FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE customer_user_id = auth.uid()));

-- 3. Payments table (populated by Stripe webhook later; MRR can be estimated meanwhile)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  stripe_invoice_id text UNIQUE,
  amount_cents integer NOT NULL,
  status text NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_owner_read ON public.payments
  FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));
CREATE POLICY payments_admin_read ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS payments_store_paid_idx ON public.payments(store_id, paid_at DESC);

-- 4. Admin-only tables
CREATE TYPE public.churn_reason AS ENUM ('preco', 'complexidade', 'mudou_ramo', 'nao_deu_certo', 'sem_tempo', 'outro');

CREATE TABLE IF NOT EXISTS public.churn_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reason public.churn_reason NOT NULL,
  note text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.churn_reasons TO authenticated;
GRANT ALL ON public.churn_reasons TO service_role;
ALTER TABLE public.churn_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY churn_reasons_admin_all ON public.churn_reasons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_actions_admin_all ON public.admin_actions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS admin_actions_store_idx ON public.admin_actions(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notes TO authenticated;
GRANT ALL ON public.admin_notes TO service_role;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_notes_admin_all ON public.admin_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invites TO authenticated;
GRANT ALL ON public.admin_invites TO service_role;
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_invites_admin_all ON public.admin_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  segment text NOT NULL,
  message_template text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.communications TO authenticated;
GRANT ALL ON public.communications TO service_role;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY communications_admin_all ON public.communications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.communications_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  rendered_message text NOT NULL,
  opened_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.communications_recipients TO authenticated;
GRANT ALL ON public.communications_recipients TO service_role;
ALTER TABLE public.communications_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY communications_recipients_admin_all ON public.communications_recipients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Store health function
CREATE OR REPLACE FUNCTION public.store_health(_store_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  last_order timestamptz;
BEGIN
  SELECT subscription_status, trial_ends_at, last_login_at INTO s
  FROM public.stores WHERE id = _store_id;

  IF s IS NULL THEN RETURN 'red'; END IF;

  IF s.subscription_status IN ('past_due', 'blocked', 'canceled') THEN
    RETURN 'red';
  END IF;

  IF s.subscription_status = 'trial' AND s.trial_ends_at < now() THEN
    RETURN 'red';
  END IF;

  SELECT MAX(created_at) INTO last_order FROM public.orders WHERE store_id = _store_id;

  IF s.subscription_status = 'trial' AND s.trial_ends_at < now() + interval '3 days' THEN
    RETURN 'yellow';
  END IF;

  IF s.last_login_at IS NOT NULL AND s.last_login_at < now() - interval '30 days' THEN
    RETURN 'red';
  END IF;

  IF s.subscription_status = 'active' AND (last_order IS NULL OR last_order < now() - interval '7 days') THEN
    RETURN 'yellow';
  END IF;

  RETURN 'green';
END;
$$;
REVOKE ALL ON FUNCTION public.store_health(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_health(uuid) TO authenticated;

-- 6. Update handle_new_user: role depends on signup_source metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _source text;
  _role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  _source := NEW.raw_user_meta_data->>'signup_source';
  IF _source = 'customer' THEN
    _role := 'user';
  ELSE
    _role := 'owner';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- If email matches a pending admin invite, promote to admin
  IF EXISTS (SELECT 1 FROM public.admin_invites WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.admin_invites SET accepted_at = now()
      WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 7. Track last_login_at on stores
CREATE OR REPLACE FUNCTION public.sync_store_last_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.stores SET last_login_at = NEW.last_sign_in_at WHERE owner_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_store_last_login() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_last_login ON auth.users;
CREATE TRIGGER on_auth_user_last_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_store_last_login();

-- 8. Update create_public_order to accept optional customer_user_id
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

  SELECT is_open INTO _store_open FROM public.stores WHERE stores.id = _store_id;
  IF _store_open IS NULL THEN RAISE EXCEPTION 'Store not found'; END IF;
  IF NOT _store_open THEN RAISE EXCEPTION 'Store is closed'; END IF;

  INSERT INTO public.orders (store_id, customer_name, customer_whatsapp, notes, type, customer_user_id)
  VALUES (_store_id, trim(_customer_name), trim(_customer_whatsapp),
          NULLIF(trim(coalesce(_notes, '')), ''), 'reserva', _customer_user_id)
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
$$;
REVOKE ALL ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(uuid, text, text, text, jsonb, uuid) TO anon, authenticated;

-- 9. Admin RPCs

-- Overview: counts + estimated MRR (BRL)
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.stores),
    'active', (SELECT count(*) FROM public.stores WHERE subscription_status = 'active'),
    'trial', (SELECT count(*) FROM public.stores WHERE subscription_status = 'trial' AND trial_ends_at > now()),
    'trial_expired', (SELECT count(*) FROM public.stores WHERE subscription_status = 'trial' AND trial_ends_at <= now()),
    'past_due', (SELECT count(*) FROM public.stores WHERE subscription_status = 'past_due'),
    'blocked', (SELECT count(*) FROM public.stores WHERE subscription_status = 'blocked'),
    'canceled', (SELECT count(*) FROM public.stores WHERE subscription_status = 'canceled'),
    'new_today', (SELECT count(*) FROM public.stores WHERE created_at >= date_trunc('day', now())),
    'new_week', (SELECT count(*) FROM public.stores WHERE created_at >= now() - interval '7 days'),
    'new_month', (SELECT count(*) FROM public.stores WHERE created_at >= now() - interval '30 days'),
    'mrr_estimated_cents', (SELECT count(*) * 2990 FROM public.stores WHERE subscription_status = 'active'),
    'revenue_today_cents', COALESCE((SELECT sum(amount_cents) FROM public.payments WHERE paid_at >= date_trunc('day', now())), 0),
    'revenue_week_cents', COALESCE((SELECT sum(amount_cents) FROM public.payments WHERE paid_at >= now() - interval '7 days'), 0),
    'revenue_month_cents', COALESCE((SELECT sum(amount_cents) FROM public.payments WHERE paid_at >= now() - interval '30 days'), 0),
    'revenue_year_cents', COALESCE((SELECT sum(amount_cents) FROM public.payments WHERE paid_at >= now() - interval '365 days'), 0),
    'past_due_amount_cents', (SELECT count(*) * 2990 FROM public.stores WHERE subscription_status = 'past_due')
  ) INTO _out;

  RETURN _out;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;

-- List stores with filters
CREATE OR REPLACE FUNCTION public.admin_list_stores(
  _status text DEFAULT NULL,
  _health text DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  owner_email text,
  subscription_status public.subscription_status,
  trial_days_left integer,
  last_login_at timestamptz,
  last_order_at timestamptz,
  health text,
  created_at timestamptz,
  whatsapp text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.slug,
    u.email::text AS owner_email,
    s.subscription_status,
    GREATEST(0, EXTRACT(day FROM (s.trial_ends_at - now()))::integer) AS trial_days_left,
    s.last_login_at,
    (SELECT MAX(created_at) FROM public.orders WHERE store_id = s.id) AS last_order_at,
    public.store_health(s.id) AS health,
    s.created_at,
    s.whatsapp
  FROM public.stores s
  LEFT JOIN auth.users u ON u.id = s.owner_id
  WHERE (_status IS NULL OR s.subscription_status::text = _status)
    AND (_search IS NULL OR s.name ILIKE '%'||_search||'%' OR s.slug ILIKE '%'||_search||'%' OR u.email ILIKE '%'||_search||'%')
    AND (_health IS NULL OR public.store_health(s.id) = _health)
  ORDER BY s.created_at DESC
  LIMIT _limit OFFSET _offset;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_stores(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_stores(text, text, text, integer, integer) TO authenticated;

-- Store detail
CREATE OR REPLACE FUNCTION public.admin_store_detail(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id, 'name', s.name, 'slug', s.slug, 'description', s.description,
      'whatsapp', s.whatsapp, 'city', s.city, 'state', s.state, 'address', s.address,
      'subscription_status', s.subscription_status, 'trial_ends_at', s.trial_ends_at,
      'last_login_at', s.last_login_at, 'is_open', s.is_open, 'created_at', s.created_at,
      'health', public.store_health(s.id),
      'owner_email', u.email
    ),
    'total_orders', (SELECT count(*) FROM public.orders WHERE store_id = s.id),
    'total_revenue_cents', COALESCE((SELECT sum(amount_cents) FROM public.payments WHERE store_id = s.id), 0),
    'churn_reason', (
      SELECT jsonb_build_object('reason', cr.reason, 'note', cr.note, 'created_at', cr.created_at)
      FROM public.churn_reasons cr WHERE cr.store_id = s.id
      ORDER BY cr.created_at DESC LIMIT 1
    ),
    'actions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('action', a.action, 'payload', a.payload, 'created_at', a.created_at) ORDER BY a.created_at DESC)
      FROM public.admin_actions a WHERE a.store_id = s.id
    ), '[]'::jsonb),
    'notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('note', n.note, 'created_at', n.created_at) ORDER BY n.created_at DESC)
      FROM public.admin_notes n WHERE n.store_id = s.id
    ), '[]'::jsonb)
  ) INTO _out
  FROM public.stores s
  LEFT JOIN auth.users u ON u.id = s.owner_id
  WHERE s.id = _store_id;

  RETURN _out;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_store_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_store_detail(uuid) TO authenticated;

-- Admin action: change subscription status
CREATE OR REPLACE FUNCTION public.admin_set_subscription_status(_store_id uuid, _status public.subscription_status, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  -- guard trigger bypasses on service_role only; use SET LOCAL to temporarily allow
  PERFORM set_config('role', 'service_role', true);
  UPDATE public.stores SET subscription_status = _status WHERE id = _store_id;
  PERFORM set_config('role', current_user, true);
  INSERT INTO public.admin_actions (admin_id, store_id, action, payload)
  VALUES (auth.uid(), _store_id, 'set_subscription_status', jsonb_build_object('status', _status, 'reason', _reason));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_subscription_status(uuid, public.subscription_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid, public.subscription_status, text) TO authenticated;

-- Admin action: extend trial
CREATE OR REPLACE FUNCTION public.admin_extend_trial(_store_id uuid, _days integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _days < 1 OR _days > 90 THEN RAISE EXCEPTION 'Invalid days'; END IF;
  PERFORM set_config('role', 'service_role', true);
  UPDATE public.stores SET trial_ends_at = GREATEST(trial_ends_at, now()) + make_interval(days => _days) WHERE id = _store_id;
  PERFORM set_config('role', current_user, true);
  INSERT INTO public.admin_actions (admin_id, store_id, action, payload)
  VALUES (auth.uid(), _store_id, 'extend_trial', jsonb_build_object('days', _days));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_extend_trial(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer) TO authenticated;

-- Admin action: add note
CREATE OR REPLACE FUNCTION public.admin_add_note(_store_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.admin_notes (store_id, admin_id, note) VALUES (_store_id, auth.uid(), _note);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_add_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_note(uuid, text) TO authenticated;

-- Admin action: register churn reason
CREATE OR REPLACE FUNCTION public.admin_register_churn(_store_id uuid, _reason public.churn_reason, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.churn_reasons (store_id, reason, note, created_by) VALUES (_store_id, _reason, _note, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.admin_register_churn(uuid, public.churn_reason, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_register_churn(uuid, public.churn_reason, text) TO authenticated;

-- Invite admin
CREATE OR REPLACE FUNCTION public.admin_invite(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _email IS NULL OR position('@' IN _email) = 0 THEN RAISE EXCEPTION 'Invalid email'; END IF;

  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email);
  IF _uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    RETURN jsonb_build_object('status', 'promoted', 'user_id', _uid);
  END IF;

  INSERT INTO public.admin_invites (email, invited_by) VALUES (lower(_email), auth.uid())
    ON CONFLICT (email) DO NOTHING;
  RETURN jsonb_build_object('status', 'pending');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_invite(text) TO authenticated;

-- List admins
CREATE OR REPLACE FUNCTION public.admin_list_team()
RETURNS TABLE(user_id uuid, email text, full_name text, invited boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT ur.user_id, u.email::text, p.full_name, false
      FROM public.user_roles ur
      JOIN auth.users u ON u.id = ur.user_id
      LEFT JOIN public.profiles p ON p.id = ur.user_id
     WHERE ur.role = 'admin'
    UNION ALL
    SELECT NULL::uuid, ai.email::text, NULL::text, true
      FROM public.admin_invites ai
     WHERE ai.accepted_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_team() TO authenticated;

-- Trial recovery metrics
CREATE OR REPLACE FUNCTION public.admin_trial_metrics(_window_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _out jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'converted', (SELECT count(*) FROM public.stores WHERE subscription_status = 'active' AND created_at >= now() - make_interval(days => _window_days)),
    'expired', (SELECT count(*) FROM public.stores WHERE subscription_status = 'trial' AND trial_ends_at < now() AND created_at >= now() - make_interval(days => _window_days)),
    'still_trialing', (SELECT count(*) FROM public.stores WHERE subscription_status = 'trial' AND trial_ends_at > now() AND created_at >= now() - make_interval(days => _window_days)),
    'canceled', (SELECT count(*) FROM public.stores WHERE subscription_status = 'canceled' AND created_at >= now() - make_interval(days => _window_days)),
    'reasons', COALESCE((SELECT jsonb_object_agg(reason, cnt) FROM (SELECT reason, count(*) cnt FROM public.churn_reasons WHERE created_at >= now() - make_interval(days => _window_days) GROUP BY reason) x), '{}'::jsonb)
  ) INTO _out;
  RETURN _out;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_trial_metrics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_trial_metrics(integer) TO authenticated;

-- List non-subscribers post trial for recovery
CREATE OR REPLACE FUNCTION public.admin_recovery_list()
RETURNS TABLE(store_id uuid, name text, whatsapp text, days_since_trial integer, owner_email text, reason public.churn_reason)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT s.id, s.name, s.whatsapp,
    GREATEST(0, EXTRACT(day FROM (now() - s.trial_ends_at))::integer),
    u.email::text,
    (SELECT cr.reason FROM public.churn_reasons cr WHERE cr.store_id = s.id ORDER BY cr.created_at DESC LIMIT 1)
  FROM public.stores s
  LEFT JOIN auth.users u ON u.id = s.owner_id
  WHERE (s.subscription_status = 'trial' AND s.trial_ends_at < now())
     OR s.subscription_status IN ('canceled', 'blocked')
  ORDER BY s.trial_ends_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_recovery_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recovery_list() TO authenticated;

-- Campaign helper: preview recipients by segment
CREATE OR REPLACE FUNCTION public.admin_segment_stores(_segment text)
RETURNS TABLE(store_id uuid, name text, whatsapp text, trial_days_left integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT s.id, s.name, s.whatsapp,
    GREATEST(0, EXTRACT(day FROM (s.trial_ends_at - now()))::integer)
  FROM public.stores s
  WHERE (
    (_segment = 'trial' AND s.subscription_status = 'trial' AND s.trial_ends_at > now())
    OR (_segment = 'active' AND s.subscription_status = 'active')
    OR (_segment = 'past_due' AND s.subscription_status = 'past_due')
    OR (_segment = 'canceled' AND s.subscription_status IN ('canceled', 'blocked'))
    OR (_segment = 'trial_expired' AND s.subscription_status = 'trial' AND s.trial_ends_at <= now())
    OR _segment = 'all'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_segment_stores(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_segment_stores(text) TO authenticated;

-- Record a campaign
CREATE OR REPLACE FUNCTION public.admin_create_campaign(_segment text, _message_template text, _recipients jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _campaign_id uuid; _rec jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.communications (admin_id, segment, message_template, recipient_count)
  VALUES (auth.uid(), _segment, _message_template, jsonb_array_length(_recipients))
  RETURNING id INTO _campaign_id;

  FOR _rec IN SELECT * FROM jsonb_array_elements(_recipients) LOOP
    INSERT INTO public.communications_recipients (communication_id, store_id, rendered_message)
    VALUES (_campaign_id, (_rec->>'store_id')::uuid, _rec->>'message');
  END LOOP;

  RETURN _campaign_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_create_campaign(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_campaign(text, text, jsonb) TO authenticated;

-- Mark recipient as opened
CREATE OR REPLACE FUNCTION public.admin_mark_recipient_opened(_recipient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.communications_recipients SET opened_at = now() WHERE id = _recipient_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_mark_recipient_opened(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_recipient_opened(uuid) TO authenticated;

-- List campaigns history
CREATE OR REPLACE FUNCTION public.admin_list_campaigns()
RETURNS TABLE(id uuid, segment text, message_template text, recipient_count integer, opened_count integer, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT c.id, c.segment, c.message_template, c.recipient_count,
    (SELECT count(*)::integer FROM public.communications_recipients cr WHERE cr.communication_id = c.id AND cr.opened_at IS NOT NULL),
    c.created_at
  FROM public.communications c
  ORDER BY c.created_at DESC LIMIT 100;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_campaigns() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_campaigns() TO authenticated;

-- User's own orders (role user) — public route needs a helper
CREATE OR REPLACE FUNCTION public.my_orders()
RETURNS TABLE(id uuid, order_number integer, store_id uuid, store_name text, store_slug text, status public.order_status, total numeric, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY
  SELECT o.id, o.order_number, o.store_id, s.name, s.slug, o.status, o.total, o.created_at
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.customer_user_id = auth.uid()
  ORDER BY o.created_at DESC LIMIT 100;
END;
$$;
REVOKE ALL ON FUNCTION public.my_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_orders() TO authenticated;
