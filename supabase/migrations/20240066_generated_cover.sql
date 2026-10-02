-- ============================================================
-- ILLUSTRATED COVER (Phase 1F)
--
-- One front-cover image per generated story, drawn from the same
-- persisted visual bible as the interior and stored next to the page
-- images at story-images/<request_id>/cover.png. The title and author
-- line are never inside the image; the reader and the PDF render them
-- as real text over/under the artwork.
--
-- Lives on generated_stories because the cover belongs to the book
-- (one per story text) and the public story API already reads this
-- row (it whitelists fields, so cover_revised_prompt stays internal).
--
-- cover_status: NULL (never attempted) | generating | complete | failed | skipped
-- The worker tolerates these columns being absent (logs cover_skipped_schema).
-- ============================================================

ALTER TABLE public.generated_stories
  ADD COLUMN IF NOT EXISTS cover_storage_path   TEXT,
  ADD COLUMN IF NOT EXISTS cover_status         TEXT,
  ADD COLUMN IF NOT EXISTS cover_model          TEXT,
  ADD COLUMN IF NOT EXISTS cover_revised_prompt TEXT,
  ADD COLUMN IF NOT EXISTS cover_attempts       SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_last_error     TEXT,
  ADD COLUMN IF NOT EXISTS cover_generated_at   TIMESTAMPTZ;

COMMENT ON COLUMN public.generated_stories.cover_storage_path IS
  'story-images bucket path of the generated front-cover artwork (no text baked in).';
COMMENT ON COLUMN public.generated_stories.cover_revised_prompt IS
  'Provider-rewritten prompt for debugging (Phase 1E privacy rules). Internal; not returned by the public API.';

NOTIFY pgrst, 'reload schema';
