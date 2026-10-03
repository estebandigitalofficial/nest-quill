-- ============================================================
-- ENTITLEMENT FOUNDATION (commercial launch, phase 1 of N)
--
-- Replaces the client-trusted plan label + lifetime books_generated
-- counter with an authoritative, server-resolved entitlement model:
--
--   profiles.free_books_used          lifetime Free counter (2 per person)
--   story_purchases                   one row = one paid (or admin-granted)
--                                     book at a given tier; consumed once
--   subscription_periods              one row per billing period with an
--                                     allowance and a used counter
--   story_requests.entitlement_*      snapshot of what the server resolved
--   story_requests.pdf_entitled       authoritative PDF flag for new rows
--
-- Reservation is atomic through the SQL functions below (conditional
-- UPDATE ... RETURNING). Nothing here reads beta_mode_enabled.
--
-- COMPATIBILITY: historical rows are NOT rewritten. entitlement_source
-- stays NULL for them and the application treats NULL as "legacy", where
-- PDF access follows the old label rule (plan_tier <> 'free'). No purchase
-- or subscription is inferred from old plan_tier values. No Stripe objects
-- are created; the stripe_* columns stay NULL until checkout ships.
--
-- HISTORICAL FREE USAGE IS NOT SEEDED HERE. free_books_used starts at 0 for
-- every existing profile. The seed depends on data at run time and must be
-- previewed first, so it lives in supabase/scripts/entitlement_free_seed_*.sql
-- and is run explicitly after this migration, once the Founder has seen the
-- preview counts.
--
-- Idempotent.
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_books_used      SMALLINT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_price_id      TEXT;

-- ── story_purchases ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.story_purchases (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                        TEXT        NOT NULL CHECK (tier IN ('single', 'story_pack', 'story_pro')),
  status                      TEXT        NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'consumed', 'refunded', 'revoked')),
  source                      TEXT        NOT NULL DEFAULT 'stripe' CHECK (source IN ('stripe', 'admin')),
  stripe_checkout_session_id  TEXT        UNIQUE,
  stripe_payment_intent_id    TEXT        UNIQUE,
  amount_cents                INTEGER,
  currency                    TEXT        NOT NULL DEFAULT 'usd',
  request_id                  UUID        UNIQUE REFERENCES public.story_requests(id) ON DELETE SET NULL,
  granted_by                  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  note                        TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at                 TIMESTAMPTZ,
  refunded_at                 TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_story_purchases_user_status ON public.story_purchases (user_id, status);
ALTER TABLE public.story_purchases ENABLE ROW LEVEL SECURITY;  -- service role only

-- ── subscription_periods ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_periods (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT,
  plan_tier               TEXT        NOT NULL CHECK (plan_tier IN ('story_pack', 'story_pro')),
  period_start            TIMESTAMPTZ NOT NULL,
  period_end              TIMESTAMPTZ NOT NULL,
  allowance               SMALLINT    NOT NULL CHECK (allowance >= 0),
  used                    SMALLINT    NOT NULL DEFAULT 0 CHECK (used >= 0 AND used <= allowance),
  source                  TEXT        NOT NULL DEFAULT 'stripe' CHECK (source IN ('stripe', 'admin')),
  granted_by              UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  note                    TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end > period_start),
  -- One row per Stripe billing period; webhook retries become no-ops.
  UNIQUE (stripe_subscription_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_subscription_periods_user_window ON public.subscription_periods (user_id, period_start, period_end);
ALTER TABLE public.subscription_periods ENABLE ROW LEVEL SECURITY;  -- service role only

-- ── story_requests snapshot ──────────────────────────────────
ALTER TABLE public.story_requests
  ADD COLUMN IF NOT EXISTS entitlement_source TEXT CHECK (entitlement_source IN ('free', 'purchase', 'subscription', 'admin')),
  ADD COLUMN IF NOT EXISTS entitlement_ref    UUID,
  ADD COLUMN IF NOT EXISTS pdf_entitled       BOOLEAN NOT NULL DEFAULT false,
  -- Set once when a FREE reservation is given back after a terminal technical
  -- failure. Paid sources never use it (support handles those cases).
  ADD COLUMN IF NOT EXISTS entitlement_released_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_story_requests_entitlement_ref ON public.story_requests (entitlement_ref) WHERE entitlement_ref IS NOT NULL;

-- ── Atomic reservation functions ─────────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_free_book(p_user_id UUID, p_limit INT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.profiles SET free_books_used = free_books_used + 1
    WHERE id = p_user_id AND free_books_used < p_limit
    RETURNING id
  ) SELECT EXISTS (SELECT 1 FROM u);
$$;

CREATE OR REPLACE FUNCTION public.release_free_book(p_user_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET free_books_used = free_books_used - 1
  WHERE id = p_user_id AND free_books_used > 0;
$$;

CREATE OR REPLACE FUNCTION public.reserve_purchase(p_purchase_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.story_purchases SET status = 'consumed', consumed_at = now()
    WHERE id = p_purchase_id AND user_id = p_user_id AND status = 'paid' AND request_id IS NULL
    RETURNING id
  ) SELECT EXISTS (SELECT 1 FROM u);
$$;

-- Compensation only (row insert failed). A purchase that reached a story
-- is never released automatically; support handles those cases.
CREATE OR REPLACE FUNCTION public.release_purchase(p_purchase_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.story_purchases SET status = 'paid', consumed_at = NULL
  WHERE id = p_purchase_id AND status = 'consumed' AND request_id IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.reserve_subscription_unit(p_period_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.subscription_periods SET used = used + 1
    WHERE id = p_period_id AND user_id = p_user_id AND used < allowance
      AND period_start <= now() AND period_end > now()
    RETURNING id
  ) SELECT EXISTS (SELECT 1 FROM u);
$$;

CREATE OR REPLACE FUNCTION public.release_subscription_unit(p_period_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.subscription_periods SET used = used - 1
  WHERE id = p_period_id AND used > 0;
$$;

-- ── Guest Free counting (normalized exact match, no pattern semantics) ──
-- Counts non-failed Free rows made by this guest, matched by the cookie
-- token OR by a normalized exact email comparison. '%' and '_' in an
-- address are literal characters here.
CREATE OR REPLACE FUNCTION public.count_guest_free_books(p_guest_token UUID, p_email TEXT)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INT
  FROM public.story_requests r
  WHERE r.user_id IS NULL
    AND r.plan_tier = 'free'
    AND r.status <> 'failed'
    AND (
      r.guest_token = p_guest_token
      OR (p_email IS NOT NULL AND length(btrim(p_email)) > 0
          AND lower(btrim(r.user_email)) = lower(btrim(p_email)))
    );
$$;

-- ── FREE-only release after a terminal technical failure ─────
-- Gives back exactly one lifetime Free slot for a story that
--   * was reserved from the Free counter (entitlement_source = 'free'),
--   * belongs to an account (guests have no counter; their failed rows are
--     simply not counted),
--   * is in status 'failed',
--   * never completed (usage_counted flips true at completion and is never
--     reset, so a completed-then-requeued story can never be released),
--   * has not been released before (entitlement_released_at IS NULL).
-- The caller decides "terminal" (retry rules); this function enforces the
-- rest atomically. Purchases and subscription units have NO such function.
CREATE OR REPLACE FUNCTION public.release_free_reservation(p_request_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID;
BEGIN
  UPDATE public.story_requests SET entitlement_released_at = now()
  WHERE id = p_request_id
    AND entitlement_source = 'free'
    AND user_id IS NOT NULL
    AND status = 'failed'
    AND usage_counted = false
    AND entitlement_released_at IS NULL
  RETURNING user_id INTO v_user;
  IF v_user IS NULL THEN RETURN false; END IF;
  UPDATE public.profiles SET free_books_used = GREATEST(0, free_books_used - 1) WHERE id = v_user;
  RETURN true;
END;
$$;

-- ── Guest → account reconciliation ───────────────────────────
-- Cookie path: the guest_token is a capability only that browser holds.
-- Transfers ownership of the guest's rows and counts their non-failed Free
-- books toward the account's lifetime allowance (never above p_limit).
-- Idempotent: already-owned rows are not matched a second time.
CREATE OR REPLACE FUNCTION public.claim_guest_stories(p_user_id UUID, p_guest_token UUID, p_limit INT DEFAULT 2)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_claimed INT;
  v_free    INT;
BEGIN
  WITH c AS (
    UPDATE public.story_requests SET user_id = p_user_id
    WHERE guest_token = p_guest_token AND user_id IS NULL
    RETURNING plan_tier, status, entitlement_source
  )
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status <> 'failed' AND (entitlement_source = 'free' OR (entitlement_source IS NULL AND plan_tier = 'free')))
    INTO v_claimed, v_free
  FROM c;

  IF v_free > 0 THEN
    UPDATE public.profiles SET free_books_used = LEAST(p_limit, free_books_used + v_free)
    WHERE id = p_user_id;
  END IF;
  RETURN COALESCE(v_claimed, 0);
END;
$$;

-- Verified-email path: used only when the cookie is gone (another device)
-- and only after Supabase has confirmed the address (callers check
-- email_confirmed_at). Normalized EXACT equality on both sides — never a
-- pattern match, so '%' and '_' are literal. Only unowned guest rows are
-- touched, so a row already owned by anyone is never transferred, and a
-- second run finds nothing (idempotent). Ownership follows the confirmed
-- email; the Free allowance is reduced by at most p_cap completed books so
-- a stranger typing someone else's address cannot burn more than one.
CREATE OR REPLACE FUNCTION public.claim_guest_stories_by_verified_email(p_user_id UUID, p_email TEXT, p_cap INT DEFAULT 1, p_limit INT DEFAULT 2)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_claimed INT;
  v_free    INT;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN RETURN 0; END IF;
  WITH c AS (
    UPDATE public.story_requests SET user_id = p_user_id
    WHERE user_id IS NULL AND guest_token IS NOT NULL AND lower(btrim(user_email)) = lower(btrim(p_email))
    RETURNING plan_tier, status, entitlement_source
  )
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'complete' AND (entitlement_source = 'free' OR (entitlement_source IS NULL AND plan_tier = 'free')))
    INTO v_claimed, v_free
  FROM c;

  IF v_free > 0 THEN
    UPDATE public.profiles SET free_books_used = LEAST(p_limit, free_books_used + LEAST(v_free, p_cap))
    WHERE id = p_user_id;
  END IF;
  RETURN COALESCE(v_claimed, 0);
END;
$$;

-- ── Admin switch for the verified-email path ─────────────────
INSERT INTO public.app_settings (key, value, category, label, description) VALUES
  ('free_email_reconciliation_enabled', 'true', 'plans', 'Count guest Free books by verified email',
   'When a new account''s email is confirmed and no guest cookie is present, guest stories made with that exact email are attached to the account and at most one completed Free book counts toward the two-book allowance.')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
