-- Lightweight rate limiting for learning API routes (no Upstash needed)
CREATE TABLE public.learning_rate_limits (
  id         BIGSERIAL PRIMARY KEY,
  ip         TEXT NOT NULL,
  route      TEXT NOT NULL,   -- e.g. 'flashcards', 'explain', 'math'
  hit_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lrl_ip_route_time ON public.learning_rate_limits (ip, route, hit_at);

-- Auto-delete rows older than 1 hour to keep the table small
CREATE OR REPLACE FUNCTION public.prune_learning_rate_limits() RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.learning_rate_limits WHERE hit_at < now() - interval '1 hour';
END;
$$;

ALTER TABLE public.learning_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to learning_rate_limits"
  ON public.learning_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);
