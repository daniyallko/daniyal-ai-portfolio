CREATE TABLE public.api_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL,
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.api_rate_limits TO service_role;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_api_rate_limits_expiry ON public.api_rate_limits(expires_at);

ALTER TABLE public.chat_threads
  ADD COLUMN memory_summary text NOT NULL DEFAULT '',
  ADD COLUMN memory_message_count integer NOT NULL DEFAULT 0;

CREATE FUNCTION public.consume_rate_limit(
  _key text,
  _limit integer,
  _window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bucket record;
BEGIN
  IF random() < 0.001 THEN
    DELETE FROM public.api_rate_limits WHERE expires_at < now() - interval '1 day';
  END IF;

  INSERT INTO public.api_rate_limits AS limits (
    key, window_started_at, request_count, expires_at
  ) VALUES (
    _key, now(), 1, now() + make_interval(secs => _window_seconds)
  )
  ON CONFLICT (key) DO UPDATE SET
    request_count = CASE
      WHEN limits.expires_at <= now() THEN 1
      ELSE LEAST(limits.request_count + 1, _limit + 1)
    END,
    window_started_at = CASE
      WHEN limits.expires_at <= now() THEN now()
      ELSE limits.window_started_at
    END,
    expires_at = CASE
      WHEN limits.expires_at <= now() THEN now() + make_interval(secs => _window_seconds)
      ELSE limits.expires_at
    END
  RETURNING window_started_at, request_count, expires_at INTO bucket;

  allowed := bucket.request_count <= _limit;
  remaining := GREATEST(0, _limit - bucket.request_count);
  retry_after := CASE
    WHEN allowed THEN 0
    ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (bucket.expires_at - now())))::integer)
  END;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
