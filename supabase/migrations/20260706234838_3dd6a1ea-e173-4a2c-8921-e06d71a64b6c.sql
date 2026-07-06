
-- 1. Table to track rate-limited events per authenticated user
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SECURITY DEFINER functions access this table with the function owner's privileges;
-- clients never touch it directly, so only service_role needs a grant.
GRANT ALL ON public.rate_limit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_events_id_seq TO service_role;

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- No policies: no direct client access. SECURITY DEFINER functions bypass RLS.

CREATE INDEX IF NOT EXISTS rate_limit_events_lookup_idx
  ON public.rate_limit_events (user_id, action, created_at DESC);

-- 2. Rate-limit check helper. Returns void; raises with response.status=429 when exceeded.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _action TEXT,
  _max INTEGER,
  _window_seconds INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _count INTEGER;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Opportunistic cleanup: drop events older than 24h (bounded work, keeps table small)
  DELETE FROM public.rate_limit_events
    WHERE created_at < now() - interval '24 hours';

  SELECT count(*) INTO _count
    FROM public.rate_limit_events
   WHERE user_id = _uid
     AND action = _action
     AND created_at > now() - make_interval(secs => _window_seconds);

  IF _count >= _max THEN
    -- Tell PostgREST to reply with HTTP 429 + Retry-After header
    PERFORM set_config('response.status', '429', true);
    PERFORM set_config(
      'response.headers',
      '[{"Retry-After": "' || _window_seconds::text || '"}]',
      true
    );
    RAISE EXCEPTION 'Rate limit exceeded for action %', _action
      USING HINT = 'Aguarde antes de tentar novamente';
  END IF;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (_uid, _action);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated, service_role;

-- 3. Wire rate limits into admin RPCs. Wrappers keep original logic intact.

-- admin_invite: 10 convites / hora
CREATE OR REPLACE FUNCTION public.admin_invite(_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.check_rate_limit('admin_invite', 10, 3600);
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
$function$;

-- admin_extend_trial: 30 / hora
CREATE OR REPLACE FUNCTION public.admin_extend_trial(_store_id uuid, _days integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.check_rate_limit('admin_extend_trial', 30, 3600);
  IF _days < 1 OR _days > 90 THEN RAISE EXCEPTION 'Invalid days'; END IF;
  PERFORM set_config('role', 'service_role', true);
  UPDATE public.stores SET trial_ends_at = GREATEST(trial_ends_at, now()) + make_interval(days => _days) WHERE id = _store_id;
  PERFORM set_config('role', current_user, true);
  INSERT INTO public.admin_actions (admin_id, store_id, action, payload)
  VALUES (auth.uid(), _store_id, 'extend_trial', jsonb_build_object('days', _days));
END;
$function$;

-- admin_set_subscription_status: 30 / hora
CREATE OR REPLACE FUNCTION public.admin_set_subscription_status(_store_id uuid, _status subscription_status, _reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.check_rate_limit('admin_set_subscription_status', 30, 3600);
  PERFORM set_config('role', 'service_role', true);
  UPDATE public.stores SET subscription_status = _status WHERE id = _store_id;
  PERFORM set_config('role', current_user, true);
  INSERT INTO public.admin_actions (admin_id, store_id, action, payload)
  VALUES (auth.uid(), _store_id, 'set_subscription_status', jsonb_build_object('status', _status, 'reason', _reason));
END;
$function$;

-- admin_add_note: 60 / hora
CREATE OR REPLACE FUNCTION public.admin_add_note(_store_id uuid, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.check_rate_limit('admin_add_note', 60, 3600);
  INSERT INTO public.admin_notes (store_id, admin_id, note) VALUES (_store_id, auth.uid(), _note);
END;
$function$;

-- admin_register_churn: 60 / hora
CREATE OR REPLACE FUNCTION public.admin_register_churn(_store_id uuid, _reason churn_reason, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.check_rate_limit('admin_register_churn', 60, 3600);
  INSERT INTO public.churn_reasons (store_id, reason, note, created_by) VALUES (_store_id, _reason, _note, auth.uid());
END;
$function$;

-- admin_create_campaign: 5 / hora (envio em massa é a ação mais cara)
CREATE OR REPLACE FUNCTION public.admin_create_campaign(_segment text, _message_template text, _recipients jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _campaign_id uuid; _rec jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.check_rate_limit('admin_create_campaign', 5, 3600);
  INSERT INTO public.communications (admin_id, segment, message_template, recipient_count)
  VALUES (auth.uid(), _segment, _message_template, jsonb_array_length(_recipients))
  RETURNING id INTO _campaign_id;

  FOR _rec IN SELECT * FROM jsonb_array_elements(_recipients) LOOP
    INSERT INTO public.communications_recipients (communication_id, store_id, rendered_message)
    VALUES (_campaign_id, (_rec->>'store_id')::uuid, _rec->>'message');
  END LOOP;

  RETURN _campaign_id;
END;
$function$;

-- Preserve the previous grants (revoked PUBLIC in the earlier hardening migration)
REVOKE EXECUTE ON FUNCTION public.admin_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_invite(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid, subscription_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_status(uuid, subscription_status, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_add_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_note(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_register_churn(uuid, churn_reason, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_register_churn(uuid, churn_reason, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_create_campaign(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_campaign(text, text, jsonb) TO authenticated;
