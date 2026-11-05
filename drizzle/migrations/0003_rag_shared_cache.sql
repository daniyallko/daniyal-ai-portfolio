CREATE TABLE public.rag_query_cache (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 cache_key TEXT UNIQUE NOT NULL,
 canonical_english_query TEXT NOT NULL,
 lang_code TEXT NOT NULL DEFAULT 'en',
 matched_chunk_ids TEXT[] NOT NULL DEFAULT '{}',
 retrieved_context TEXT NOT NULL,
 response_text TEXT NOT NULL DEFAULT '',
 tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
 hit_count INTEGER NOT NULL DEFAULT 1,
 compute_saved_ms INTEGER NOT NULL DEFAULT 450,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 corpus_version TEXT NOT NULL DEFAULT '',
 sources JSONB NOT NULL DEFAULT '[]'::jsonb,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);
GRANT SELECT ON public.rag_query_cache TO anon, authenticated;
GRANT ALL ON public.rag_query_cache TO service_role;
ALTER TABLE public.rag_query_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public portfolio cache read" ON public.rag_query_cache FOR SELECT TO anon, authenticated USING (expires_at > now());
CREATE INDEX idx_rag_cache_hits ON public.rag_query_cache (hit_count DESC, last_accessed_at DESC);
CREATE INDEX idx_rag_cache_expiry ON public.rag_query_cache (expires_at);
CREATE FUNCTION public.touch_rag_cache(_key text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ UPDATE public.rag_query_cache SET hit_count = hit_count + 1, last_accessed_at = now() WHERE cache_key = _key; $$;
REVOKE ALL ON FUNCTION public.touch_rag_cache(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_rag_cache(text) TO service_role;