-- ============================================================
-- RATE LIMIT EVENTS — block-only audit log
--
-- Records ONLY the throttled / blocked attempts (not every request).
-- The actual rate-limit counts come from existing tables
-- (story_requests, support_tickets) so the hot path does not write
-- per request. This table is the single place admin Beta Ops reads
-- to show "throttles today".
--
-- Idempotent. Service-role only — no RLS policies are needed.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id          BIGSERIAL PRIMARY KEY,
  action      TEXT NOT NULL,                    -- 'story_submit' | 'support_ticket' | 'queue_critical'
  reason      TEXT NOT NULL,                    -- 'hour' | 'day' | 'queue_warning' | 'queue_critical'
  user_id     UUID,
  email       TEXT,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created
  ON public.rate_limit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_action_created
  ON public.rate_limit_events (action, created_at DESC);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
-- No policies → service role only. The admin client reads + writes.

NOTIFY pgrst, 'reload schema';
