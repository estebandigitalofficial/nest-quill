-- ============================================================
-- SPONSORS — admin-managed brand partners and reward programs
-- ============================================================
-- Three tables form the foundation:
--   sponsors             one row per brand partner
--   sponsor_allocations  budget split (rewards / prizes / etc.)
--   sponsor_rewards      individual reward offers a sponsor funds
--
-- All amounts are stored in cents to avoid float math. RLS allows
-- service-role access only — admin routes use the service client.
-- ============================================================

-- ── SPONSORS ───────────────────────────────────────────────────
CREATE TABLE public.sponsors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  logo_url     TEXT,
  description  TEXT,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url  TEXT,
  total_budget_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_budget_cents >= 0),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsors_active ON public.sponsors (is_active) WHERE is_active;

CREATE TRIGGER sponsors_updated_at
  BEFORE UPDATE ON public.sponsors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── SPONSOR ALLOCATIONS ────────────────────────────────────────
-- Splits the total_budget across categories (e.g. rewards, prizes,
-- promotion). Sum of allocated_cents per sponsor must not exceed
-- total_budget_cents — enforced in app code rather than CHECK so
-- admins can stage adjustments without fighting the constraint.
CREATE TABLE public.sponsor_allocations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id    UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN ('rewards', 'prizes', 'promotion', 'other')),
  allocated_cents INTEGER NOT NULL DEFAULT 0 CHECK (allocated_cents >= 0),
  spent_cents     INTEGER NOT NULL DEFAULT 0 CHECK (spent_cents >= 0),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sponsor_id, category)
);

CREATE INDEX idx_sponsor_allocations_sponsor ON public.sponsor_allocations (sponsor_id);

CREATE TRIGGER sponsor_allocations_updated_at
  BEFORE UPDATE ON public.sponsor_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── SPONSOR REWARDS ────────────────────────────────────────────
-- A reward offer funded by a sponsor. unlock_condition is JSONB so
-- different reward types can carry different criteria without new
-- columns.
CREATE TABLE public.sponsor_rewards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id    UUID NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 160),
  description   TEXT,
  reward_type   TEXT NOT NULL CHECK (reward_type IN ('free_item', 'discount', 'digital_reward')),
  -- Per-redemption value at this point in the program. For a free
  -- item this is the retail value used to debit the budget; for a
  -- discount it can be the average expected redemption.
  value_cents   INTEGER NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
  -- Optional cap on how many can be redeemed. NULL = unlimited.
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions >= 0),
  redemption_count INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  -- Examples:
  --   { "type": "points", "min_points": 500 }
  --   { "type": "achievement", "slug": "ten_quests" }
  --   { "type": "completion", "subject": "math", "grade": 4 }
  unlock_condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sponsor_rewards_sponsor ON public.sponsor_rewards (sponsor_id);
CREATE INDEX idx_sponsor_rewards_active  ON public.sponsor_rewards (is_active) WHERE is_active;

CREATE TRIGGER sponsor_rewards_updated_at
  BEFORE UPDATE ON public.sponsor_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────
-- Service role only. Public/student-facing read access can be added
-- later when rewards are surfaced in-app.
ALTER TABLE public.sponsors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_allocations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_rewards      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to sponsors"
  ON public.sponsors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to sponsor_allocations"
  ON public.sponsor_allocations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to sponsor_rewards"
  ON public.sponsor_rewards FOR ALL TO service_role USING (true) WITH CHECK (true);
