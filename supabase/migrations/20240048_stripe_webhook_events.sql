-- ============================================================
-- STRIPE WEBHOOK EVENT LOG
-- Foundation table for the future /api/stripe/webhook route.
-- Today nothing writes to it; the admin settings panel reads
-- the most-recent row to surface webhook health when the
-- webhook handler eventually lands.
--
-- Idempotent. Admin reads happen via service-role only — RLS
-- is enabled with no policies so non-service callers see nothing.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id           BIGSERIAL PRIMARY KEY,
  event_id     TEXT        NOT NULL UNIQUE,           -- evt_… from Stripe; UNIQUE for idempotency
  type         TEXT        NOT NULL,                  -- e.g. checkout.session.completed
  livemode     BOOLEAN     NOT NULL,                  -- mirrors Stripe's livemode field
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),    -- our wall-clock when the webhook arrived
  processed_at TIMESTAMPTZ,                           -- set after the handler successfully ran
  error        TEXT,                                  -- exception message when handling failed
  payload      JSONB                                  -- full event body for debugging / replay
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at
  ON public.stripe_webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
  ON public.stripe_webhook_events (type);

-- RLS on with no policies = service role only. The admin client uses the
-- service role key, so admin pages can read; users cannot.
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Reload PostgREST schema cache so the new table is reachable from the API.
NOTIFY pgrst, 'reload schema';
