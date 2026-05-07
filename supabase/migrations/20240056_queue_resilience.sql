-- ============================================================
-- QUEUE RESILIENCE
--
-- 1. idempotency_keys      — short-window dedupe for /api/story/submit
-- 2. worker_lease_expires_at + worker_heartbeat_at on story_requests
--                          — heartbeat-driven worker locks
-- 3. retry_after on story_requests
--                          — server-side retry cooldown / storm protection
--
-- All additive + idempotent. Nothing about the existing claim path
-- (worker_id atomic UPDATE) is removed; the new columns let the Edge
-- Function expand the "worker_id IS NULL" predicate to also accept
-- "lease expired" without breaking anything.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,                       -- sha256 hash or client-supplied token
  scope       TEXT NOT NULL DEFAULT 'story_submit',
  request_id  UUID,                                       -- the story_requests row this key produced
  status_code INT NOT NULL DEFAULT 200,                   -- recorded HTTP status of the original response
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes'
);

-- Reads always filter to non-expired rows, so the index includes that.
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup
  ON public.idempotency_keys (key)
  WHERE expires_at > now();

-- Cleanup index — admin/cron can DELETE FROM idempotency_keys WHERE expires_at < now() periodically.
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires
  ON public.idempotency_keys (expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
-- Service-role only — no policies. The submit route uses the admin client.

-- ── Worker lease columns ─────────────────────────────────────────────
ALTER TABLE public.story_requests
  ADD COLUMN IF NOT EXISTS worker_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_heartbeat_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_after             TIMESTAMPTZ;

-- Hot path index for "claim eligible" reads. Partial — only rows with
-- a non-null worker_id matter for lease eligibility.
CREATE INDEX IF NOT EXISTS idx_story_requests_worker_lease
  ON public.story_requests (worker_lease_expires_at)
  WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_story_requests_retry_after
  ON public.story_requests (retry_after)
  WHERE retry_after IS NOT NULL;

NOTIFY pgrst, 'reload schema';
