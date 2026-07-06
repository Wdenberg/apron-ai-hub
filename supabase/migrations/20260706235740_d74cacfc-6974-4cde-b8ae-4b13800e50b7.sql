
-- Plan enum + columns
DO $$ BEGIN
  CREATE TYPE public.subscription_plan AS ENUM ('mensal','trimestral','semestral','anual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS plan public.subscription_plan,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;

-- Guard trigger allows plan/subscription_ends_at only via service_role
CREATE OR REPLACE FUNCTION public.guard_store_payment_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at
  THEN RAISE EXCEPTION 'Cannot modify billing fields directly'; END IF;
  RETURN NEW;
END; $$;

-- Activate with plan
CREATE OR REPLACE FUNCTION public.admin_activate_with_plan(_store_id uuid, _plan public.subscription_plan)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _months integer; _base timestamptz; _new_end timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.check_rate_limit('admin_activate_with_plan', 30, 3600);
  _months := CASE _plan WHEN 'mensal' THEN 1 WHEN 'trimestral' THEN 3 WHEN 'semestral' THEN 6 WHEN 'anual' THEN 12 END;
  SELECT GREATEST(COALESCE(subscription_ends_at, now()), now()) INTO _base FROM public.stores WHERE id = _store_id;
  IF _base IS NULL THEN RAISE EXCEPTION 'Store not found'; END IF;
  _new_end := _base + make_interval(months => _months);
  PERFORM set_config('role', 'service_role', true);
  UPDATE public.stores SET subscription_status = 'active', plan = _plan, subscription_ends_at = _new_end WHERE id = _store_id;
  PERFORM set_config('role', current_user, true);
  INSERT INTO public.admin_actions (admin_id, store_id, action, payload)
  VALUES (auth.uid(), _store_id, 'activate_with_plan', jsonb_build_object('plan', _plan, 'subscription_ends_at', _new_end));
END; $$;

REVOKE ALL ON FUNCTION public.admin_activate_with_plan(uuid, public.subscription_plan) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_activate_with_plan(uuid, public.subscription_plan) TO authenticated;

-- Recreate admin_list_stores with plan + subscription_ends_at
DROP FUNCTION IF EXISTS public.admin_list_stores(text, text, text, integer, integer);
CREATE OR REPLACE FUNCTION public.admin_list_stores(
  _status text DEFAULT NULL, _health text DEFAULT NULL, _search text DEFAULT NULL,
  _limit integer DEFAULT 50, _offset integer DEFAULT 0
) RETURNS TABLE(
  id uuid, name text, slug text, owner_email text,
  subscription_status public.subscription_status,
  plan public.subscription_plan,
  subscription_ends_at timestamptz,
  trial_days_left integer, last_login_at timestamptz, last_order_at timestamptz,
  health text, created_at timestamptz, whatsapp text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT s.id, s.name, s.slug, u.email::text,
    s.subscription_status, s.plan, s.subscription_ends_at,
    GREATEST(0, EXTRACT(day FROM (s.trial_ends_at - now()))::integer),
    s.last_login_at,
    (SELECT MAX(created_at) FROM public.orders WHERE store_id = s.id),
    public.store_health(s.id), s.created_at, s.whatsapp
  FROM public.stores s
  LEFT JOIN auth.users u ON u.id = s.owner_id
  WHERE (_status IS NULL OR s.subscription_status::text = _status)
    AND (_search IS NULL OR s.name ILIKE '%'||_search||'%' OR s.slug ILIKE '%'||_search||'%' OR u.email ILIKE '%'||_search||'%')
    AND (_health IS NULL OR public.store_health(s.id) = _health)
  ORDER BY s.created_at DESC
  LIMIT _limit OFFSET _offset;
END; $$;
