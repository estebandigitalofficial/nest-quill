-- ============================================================
-- RELAX story_theme CHECK CONSTRAINT
-- The wizard's structured Theme + Conflict + Goal selections
-- synthesize into a single sentence stored in story_theme. The
-- original 100-char ceiling was tight for that — combined phrases
-- run ~170 chars. Widening to 280 (Twitter-length) gives the
-- synthesizer comfortable room without truncation while staying
-- well within practical prompt sizes for downstream generation.
-- ============================================================

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.story_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%story_theme%BETWEEN 3 AND 100%'
  LOOP
    EXECUTE format('ALTER TABLE public.story_requests DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'story_requests_story_theme_check'
      AND conrelid = 'public.story_requests'::regclass
  ) THEN
    ALTER TABLE public.story_requests
      ADD CONSTRAINT story_requests_story_theme_check
      CHECK (char_length(story_theme) BETWEEN 3 AND 280);
  END IF;
END $$;
