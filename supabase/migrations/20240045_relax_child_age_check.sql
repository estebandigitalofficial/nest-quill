-- ============================================================
-- RELAX child_age CHECK CONSTRAINT
-- The wizard now supports Teen (13-17) and Adult (18+) tiers.
-- The original CHECK (child_age BETWEEN 1 AND 12) blocked every
-- non-child submission. Loosen the bound to 1..99; the column
-- stays SMALLINT (max 32767), so storage is unaffected.
-- ============================================================

-- Drop the old constraint regardless of how Postgres named it.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.story_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%child_age%BETWEEN 1 AND 12%'
  LOOP
    EXECUTE format('ALTER TABLE public.story_requests DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Idempotent: only add if not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'story_requests_child_age_check'
      AND conrelid = 'public.story_requests'::regclass
  ) THEN
    ALTER TABLE public.story_requests
      ADD CONSTRAINT story_requests_child_age_check
      CHECK (child_age BETWEEN 1 AND 99);
  END IF;
END $$;
