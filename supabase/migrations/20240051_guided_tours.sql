-- ============================================================
-- GUIDED TOURS — onboarding/tour foundation
--
-- Three tables:
--   guided_tours        — one row per named tour, addressed by `key`
--   guided_tour_steps   — ordered steps for each tour
--   user_tour_progress  — per-user completion/skip state
--
-- Idempotent. The default /create tour is upserted by key so re-running
-- doesn't duplicate.
--
-- Step targets use a CSS-style selector — typically `[data-tour-id="X"]`
-- on the rendered element — so designers can move UI without breaking
-- the tour as long as the data attribute moves with it.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guided_tours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  page        TEXT,                                  -- canonical path the tour runs on (e.g. /create)
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guided_tour_steps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id               UUID NOT NULL REFERENCES public.guided_tours(id) ON DELETE CASCADE,
  step_order            INT NOT NULL,
  target_selector       TEXT,                        -- nullable for centred/no-anchor steps
  title                 TEXT NOT NULL,
  body                  TEXT NOT NULL,
  placement             TEXT NOT NULL DEFAULT 'bottom'
                        CHECK (placement IN ('top', 'bottom', 'left', 'right', 'center')),
  action_label          TEXT,                        -- "Got it", "Continue", etc.
  requires_interaction  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tour_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_guided_tour_steps_tour_order
  ON public.guided_tour_steps (tour_id, step_order);

CREATE TABLE IF NOT EXISTS public.user_tour_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_key      TEXT NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT false,
  skipped       BOOLEAN NOT NULL DEFAULT false,
  last_step     INT NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tour_key)
);

CREATE INDEX IF NOT EXISTS idx_user_tour_progress_user
  ON public.user_tour_progress (user_id);

-- RLS
ALTER TABLE public.guided_tours        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guided_tour_steps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tour_progress  ENABLE ROW LEVEL SECURITY;

-- Tours + steps: any authenticated or anonymous user can read enabled
-- tours (so guests get onboarded too). Mutations are service-role only.
DROP POLICY IF EXISTS "guided_tours_select_enabled" ON public.guided_tours;
CREATE POLICY "guided_tours_select_enabled"
  ON public.guided_tours FOR SELECT USING (enabled = true);

DROP POLICY IF EXISTS "guided_tour_steps_select_via_tour" ON public.guided_tour_steps;
CREATE POLICY "guided_tour_steps_select_via_tour"
  ON public.guided_tour_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.guided_tours t
    WHERE t.id = guided_tour_steps.tour_id AND t.enabled = true
  ));

-- Progress: a user reads + writes only their own row.
DROP POLICY IF EXISTS "user_tour_progress_select_own" ON public.user_tour_progress;
CREATE POLICY "user_tour_progress_select_own"
  ON public.user_tour_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_tour_progress_upsert_own" ON public.user_tour_progress;
CREATE POLICY "user_tour_progress_upsert_own"
  ON public.user_tour_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_tour_progress_update_own" ON public.user_tour_progress;
CREATE POLICY "user_tour_progress_update_own"
  ON public.user_tour_progress FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Seed: default /create wizard tour ────────────────────────────────────
INSERT INTO public.guided_tours (key, title, description, page, enabled)
VALUES (
  'create_story_wizard',
  'Create your first story',
  'A short tour of the story wizard — pick a plan, tell us about the child, choose a theme, and submit.',
  '/create',
  true
)
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  page = EXCLUDED.page,
  updated_at = now();

-- Step inserts: replace existing steps for this tour to keep the seed
-- authoritative. Targets reference data-tour-id attributes added on the
-- wizard surface.
DELETE FROM public.guided_tour_steps WHERE tour_id = (
  SELECT id FROM public.guided_tours WHERE key = 'create_story_wizard'
);

INSERT INTO public.guided_tour_steps (tour_id, step_order, target_selector, title, body, placement)
SELECT t.id, s.step_order, s.target_selector, s.title, s.body, s.placement
FROM public.guided_tours t,
LATERAL (VALUES
  (1, NULL,                                 'Welcome 🪶',                'I''m the Nest & Quill quill, your guide for this first story. I''ll point you at each step — tap Skip any time to take it on your own.',                                                                       'center'),
  (2, '[data-tour-id="plan-step"]',         'Pick a plan',               'Start with Free if you''re just trying things out — you can upgrade later. Paid plans unlock longer stories and PDF downloads.',                                                                                'bottom'),
  (3, '[data-tour-id="child-step"]',        'Tell us about the reader',  'Their name and age shape the language and length we generate. You can also add a short description for richer characters.',                                                                                  'bottom'),
  (4, '[data-tour-id="story-step"]',        'Pick a theme',              'Choose a setting card, then add traits, a conflict, and a goal. We''ll synthesize a story prompt for you — no typing required.',                                                                                'bottom'),
  (5, '[data-tour-id="style-step"]',        'Style and length',          'Pick the illustration style and how long the story should be. During beta, illustrations may be paused, but the text will read beautifully.',                                                              'bottom'),
  (6, '[data-tour-id="review-step"]',       'Review and send',           'Confirm what you built, drop in your email, and submit. We''ll write the story in the background and notify you when it''s ready.',                                                                          'top')
) AS s(step_order, target_selector, title, body, placement)
WHERE t.key = 'create_story_wizard';

NOTIFY pgrst, 'reload schema';
