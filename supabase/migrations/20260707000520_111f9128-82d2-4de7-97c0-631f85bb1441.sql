
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
    (SELECT MAX(o.created_at) FROM public.orders o WHERE o.store_id = s.id),
    public.store_health(s.id), s.created_at, s.whatsapp
  FROM public.stores s
  LEFT JOIN auth.users u ON u.id = s.owner_id
  WHERE (_status IS NULL OR s.subscription_status::text = _status)
    AND (_search IS NULL OR s.name ILIKE '%'||_search||'%' OR s.slug ILIKE '%'||_search||'%' OR u.email ILIKE '%'||_search||'%')
    AND (_health IS NULL OR public.store_health(s.id) = _health)
  ORDER BY s.created_at DESC, s.id DESC
  LIMIT _limit OFFSET _offset;
END; $$;
