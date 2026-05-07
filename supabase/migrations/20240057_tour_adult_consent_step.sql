-- ============================================================
-- GUIDED TOURS — adult-consent branch step
--
-- The create_story_wizard tour previously got stuck on the
-- Adult / 18+ audience path. Picking the Adult card opens a
-- consent modal (checkbox + Confirm button) that must be
-- completed before the wizard will let the user advance, but
-- the tour was auto-advancing past the modal and spotlighting
-- a card that was hidden behind it.
--
-- Fix: insert a dedicated step that targets the consent modal's
-- Confirm button, marked with config.skip_if_target_missing so
-- audiences that never trigger the modal (Child / Teen) auto-
-- advance through it instead of getting stuck.
--
-- Production columns (verified against live DB):
--   guided_tours: tour_key, name, description, enabled, …
--   guided_tour_steps: id, tour_id, step_order, title, body,
--     target_selector, placement, advance_on, advance_selector,
--     wait_message, config, requires_interaction, …
--
-- Idempotent: ensures the config column exists, removes any
-- previous insertion of this step (matched by target_selector),
-- shifts later steps, then re-inserts cleanly.
-- ============================================================

-- Make sure the config column exists. Older databases may not
-- have it; this is a no-op where it does.
ALTER TABLE public.guided_tour_steps
  ADD COLUMN IF NOT EXISTS config JSONB;

DO $$
DECLARE
  v_tour_id UUID;
BEGIN
  SELECT id INTO v_tour_id
  FROM public.guided_tours
  WHERE tour_key = 'create_story_wizard'
  LIMIT 1;

  IF v_tour_id IS NULL THEN
    RAISE NOTICE 'create_story_wizard tour not found — skipping adult-consent step seed';
    RETURN;
  END IF;

  -- Drop any previous version of the adult-consent step so this
  -- migration is safely re-runnable.
  DELETE FROM public.guided_tour_steps
  WHERE tour_id = v_tour_id
    AND target_selector = '[data-tour-id="adult-consent-confirm"]';

  -- Shift steps at order >= 5 up by one to make room for the new
  -- adult-consent step at order 5. Done in two passes so we don't
  -- collide with the existing (tour_id, step_order) uniqueness.
  UPDATE public.guided_tour_steps
  SET step_order = -step_order
  WHERE tour_id = v_tour_id
    AND step_order >= 5;

  UPDATE public.guided_tour_steps
  SET step_order = (-step_order) + 1
  WHERE tour_id = v_tour_id
    AND step_order < 0;

  INSERT INTO public.guided_tour_steps
    (tour_id, step_order, target_selector, title, body, placement,
     advance_on, advance_selector, wait_message, config)
  VALUES (
    v_tour_id,
    5,
    '[data-tour-id="adult-consent-confirm"]',
    'Confirm 18+ content',
    'Because this is an adult story, check the agreement and tap Confirm to continue. (Skip this for child or teen audiences.)',
    'top',
    'click',
    '[data-tour-id="adult-consent-confirm"]',
    'Check the agreement, then tap Confirm',
    jsonb_build_object('skip_if_target_missing', true, 'requires_audience', 'adult')
  );
END $$;

NOTIFY pgrst, 'reload schema';
