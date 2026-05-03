-- ============================================================
-- SUBSCRIPTION STATE ON PROFILES
-- Mirrors the minimum Stripe subscription fields the webhook will
-- need to keep in sync. This migration only adds nullable fields
-- and an index — payments stay disabled until the checkout +
-- webhook routes ship.
--
-- subscription_status uses Stripe's vocabulary:
--   trialing | active | incomplete | incomplete_expired
--   past_due | canceled | unpaid | paused | NULL (no sub)
--
-- billing_interval reflects how the customer pays:
--   month | year | one_time | NULL
-- One-time purchases (Single Story) live here as 'one_time' so
-- reporting can distinguish MRR from one-shots without joining
-- another table.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_interval        TEXT;

-- Stripe subscription IDs are globally unique; enforce that so a
-- duplicate webhook delivery can't attach the same subscription to
-- two profiles by mistake.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_stripe_subscription_id_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_stripe_subscription_id_key
      UNIQUE (stripe_subscription_id);
  END IF;
END $$;

-- Reporting filters by status; partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status
  ON public.profiles (subscription_status)
  WHERE subscription_status IS NOT NULL;
