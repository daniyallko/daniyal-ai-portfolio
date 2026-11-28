CREATE TABLE public.visitor_telegram_messages (
  visitor_id uuid PRIMARY KEY,
  message_id bigint,
  revision bigint NOT NULL DEFAULT 0,
  delivered_revision bigint NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.visitor_telegram_messages TO service_role;
ALTER TABLE public.visitor_telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.queue_visitor_telegram(_visitor_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.visitor_telegram_messages (visitor_id, revision) VALUES (_visitor_id, 1)
  ON CONFLICT (visitor_id) DO UPDATE SET revision = visitor_telegram_messages.revision + 1, updated_at = now();
$$;

CREATE FUNCTION public.claim_visitor_telegram(_visitor_id uuid, _token uuid)
RETURNS TABLE(message_id bigint, revision bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.visitor_telegram_messages SET lease_token = _token, lease_until = now() + interval '60 seconds'
  WHERE visitor_id = _visitor_id AND revision > delivered_revision
    AND (lease_until IS NULL OR lease_until < now())
  RETURNING visitor_telegram_messages.message_id, visitor_telegram_messages.revision;
$$;

CREATE FUNCTION public.finish_visitor_telegram(_visitor_id uuid, _token uuid, _revision bigint, _message_id bigint)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.visitor_telegram_messages
  SET message_id = coalesce(_message_id, message_id), delivered_revision = greatest(delivered_revision, _revision),
      lease_token = NULL, lease_until = NULL, updated_at = now()
  WHERE visitor_id = _visitor_id AND lease_token = _token
  RETURNING revision > delivered_revision;
$$;
REVOKE ALL ON FUNCTION public.queue_visitor_telegram(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_visitor_telegram(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_visitor_telegram(uuid, uuid, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_visitor_telegram(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_visitor_telegram(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_visitor_telegram(uuid, uuid, bigint, bigint) TO service_role;