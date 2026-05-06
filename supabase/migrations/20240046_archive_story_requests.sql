-- ============================================================
-- ARCHIVE STORY REQUESTS
-- Soft-delete fields for the user-facing dashboard. Archived rows
-- stay in story_requests, story_scenes, generated_stories, and
-- storage — admins still see them, retry/requeue still works, and
-- a user can restore them. Default account list filters them out.
-- ============================================================

ALTER TABLE public.story_requests
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Partial index — most rows aren't archived; this keeps the user-list
-- "WHERE archived_at IS NULL" path index-friendly.
CREATE INDEX IF NOT EXISTS idx_story_requests_user_active
  ON public.story_requests (user_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_story_requests_user_archived
  ON public.story_requests (user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;
