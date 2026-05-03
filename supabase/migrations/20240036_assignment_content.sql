-- ============================================================
-- ASSIGNMENT CONTENT
-- Assignments now own the educator-generated content (quiz
-- questions, flashcards, passage, etc.) rather than asking the
-- student to regenerate it from a tool. Per-row JSONB so each
-- assignment type can store the shape it needs.
-- ============================================================

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill nothing — legacy rows will render as "no content" and the
-- educator can recreate them. content stays {} until populated by the
-- creation API.
