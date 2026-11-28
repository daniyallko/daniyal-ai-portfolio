CREATE OR REPLACE FUNCTION public.finish_visitor_telegram(_visitor_id uuid, _token uuid, _revision bigint, _message_id bigint DEFAULT NULL)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.visitor_telegram_messages
  SET message_id = coalesce(_message_id, message_id), delivered_revision = greatest(delivered_revision, _revision),
      lease_token = NULL, lease_until = NULL, updated_at = now()
  WHERE visitor_id = _visitor_id AND lease_token = _token
  RETURNING revision > delivered_revision;
$$;
REVOKE ALL ON FUNCTION public.finish_visitor_telegram(uuid, uuid, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_visitor_telegram(uuid, uuid, bigint, bigint) TO service_role;