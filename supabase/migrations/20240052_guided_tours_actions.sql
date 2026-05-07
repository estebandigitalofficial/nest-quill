-- ============================================================
-- GUIDED TOURS — action-based steps
--
-- Adds columns to guided_tour_steps so a step can wait for a real
-- user action (e.g. clicking a plan card, picking a theme) rather
-- than only the tour's "Next" button:
--
--   advance_on        next_button | click
--   advance_selector  CSS selector that, when clicked, advances the tour
--                     (only used when advance_on = 'click')
--   wait_message      short hint shown while the tour is waiting
--
-- Idempotent — the ALTERs use IF NOT EXISTS, and the reseed below
-- DELETEs+INSERTs the create_story_wizard steps so re-running gives
-- the same authoritative state.
-- ============================================================

ALTER TABLE public.guided_tour_steps
  ADD COLUMN IF NOT EXISTS advance_on       TEXT NOT NULL DEFAULT 'next_button',
  ADD COLUMN IF NOT EXISTS advance_selector TEXT,
  ADD COLUMN IF NOT EXISTS wait_message     TEXT;

-- Constrain advance_on to the values the runner understands. Drop the
-- old constraint first if it exists so the migration is re-runnable.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.guided_tour_steps'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%advance_on%'
  LOOP
    EXECUTE format('ALTER TABLE public.guided_tour_steps DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.guided_tour_steps
  ADD CONSTRAINT guided_tour_steps_advance_on_check
  CHECK (advance_on IN ('next_button', 'click'));

-- ── Reseed: granular, action-based create_story_wizard tour ────────────
DELETE FROM public.guided_tour_steps WHERE tour_id = (
  SELECT id FROM public.guided_tours WHERE key = 'create_story_wizard'
);

INSERT INTO public.guided_tour_steps
  (tour_id, step_order, target_selector, title, body, placement, advance_on, advance_selector, wait_message)
SELECT t.id, s.step_order, s.target_selector, s.title, s.body, s.placement, s.advance_on, s.advance_selector, s.wait_message
FROM public.guided_tours t,
LATERAL (VALUES
  (1,  NULL,                                'Welcome 🪶',
       'I''m the Nest & Quill quill. Follow me — I''ll point at what to click next. Skip any time.',
       'center',  'next_button', NULL,                                NULL),
  (2,  '[data-tour-id="plan-cards"]',       'Pick a plan',
       'Tap a plan card. Free is great to start; paid plans unlock longer stories and PDFs.',
       'top',     'click',       '[data-tour-id^="plan-card-"]',      'Tap any plan card to continue'),
  (3,  '[data-tour-id="mode-toggle"]',      'Story or Learning',
       'Story makes a personalized illustrated tale. Learning embeds a lesson into the story. Pick whichever fits, then continue.',
       'bottom',  'next_button', NULL,                                NULL),
  (4,  '[data-tour-id="audience-tier"]',    'Choose the audience',
       'Tell me who the story is for. The age tier shapes language, length, and what tones we offer.',
       'bottom',  'click',       '[data-tour-id^="audience-card-"]',  'Tap an audience card'),
  (5,  '[data-tour-id="theme-cards"]',      'Pick a theme',
       'Choose where the story takes place. Or scroll past the cards to describe your own.',
       'top',     'click',       '[data-tour-id^="theme-card-"]',     'Tap a theme card'),
  (6,  '[data-tour-id="traits-chips"]',     'Add character traits',
       'Pick up to three traits, or write your own. These shape who the hero is.',
       'bottom',  'next_button', NULL,                                NULL),
  (7,  '[data-tour-id="conflict-section"]', 'Pick a conflict and a goal',
       'What happens, and how does it end? These guide the story''s shape — choose any pair that feels right.',
       'top',     'next_button', NULL,                                NULL),
  (8,  '[data-tour-id="style-cards"]',      'Choose an illustration style',
       'Tap the style you want for the artwork. During beta, illustrations may be paused — the text still reads beautifully.',
       'top',     'click',       '[data-tour-id^="style-card-"]',     'Tap a style card'),
  (9,  '[data-tour-id="review-summary"]',   'Review your story',
       'Here''s the story you built. If anything''s off, tap Back; otherwise drop in your email below.',
       'bottom',  'next_button', NULL,                                NULL),
  (10, '[data-tour-id="submit-button"]',    'Send it 🚀',
       'When you''re ready, tap Submit. I''ll head out — your story will arrive soon.',
       'top',     'click',       '[data-tour-id="submit-button"]',    'Tap Submit to send your story')
) AS s(step_order, target_selector, title, body, placement, advance_on, advance_selector, wait_message)
WHERE t.key = 'create_story_wizard';

NOTIFY pgrst, 'reload schema';
