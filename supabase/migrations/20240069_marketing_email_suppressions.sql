-- ============================================================
-- MARKETING EMAIL SUPPRESSIONS
-- Durable opt-out list for marketing / product-engagement email
-- (signup drip, story drip, future promotional sequences).
--
-- Keyed by the normalized address (lower-cased, trimmed) and
-- deliberately NOT by profiles.user_id: guests who receive a
-- story drip have no profile, and an unsubscribe must suppress
-- the address itself regardless of account state.
--
-- A row present = suppressed. There is no "resubscribe" path in
-- this migration; removal is an explicit administrative action.
-- Transactional email (story ready / failed, submission receipt,
-- auth, support) never consults this table.
--
-- Service-role only: RLS is enabled with no policies, matching
-- stripe_webhook_events. The Next.js server reads and writes it
-- through the admin client; clients never see it.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.marketing_email_suppressions (
  email         TEXT        PRIMARY KEY
                            CHECK (email = lower(btrim(email)) AND position('@' IN email) > 1),
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT        NOT NULL DEFAULT 'unsubscribe_link'   -- unsubscribe_link | one_click | admin
);

COMMENT ON TABLE  public.marketing_email_suppressions IS
  'Addresses opted out of marketing/product-engagement email. Presence = suppressed. Never consulted for transactional mail.';
COMMENT ON COLUMN public.marketing_email_suppressions.email IS
  'Normalized recipient address: lower(btrim(email)). Matches drip_email_log.recipient_email after the same normalization.';

CREATE INDEX IF NOT EXISTS idx_marketing_email_suppressions_suppressed_at
  ON public.marketing_email_suppressions (suppressed_at DESC);

ALTER TABLE public.marketing_email_suppressions ENABLE ROW LEVEL SECURITY;

-- Reload PostgREST schema cache so the new table is reachable from the API.
NOTIFY pgrst, 'reload schema';
