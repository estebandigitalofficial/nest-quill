-- ============================================================
-- FAILURE CLASSIFICATION
--
-- Adds three additive columns to story_requests so the admin can
-- triage failures by reason instead of staring at free-text errors.
-- Existing failures stay as `last_error` only — these new fields
-- are populated going forward by the Edge Function classifier and
-- by admin mutation routes.
--
-- failure_code   — normalized identifier (OPENAI_ERROR, IMAGE_TIMEOUT…)
-- failure_stage  — pipeline stage that died (generating_text, etc.)
-- retryable      — whether an automatic or admin retry is sensible
--
-- All three are nullable so historical rows stay valid. Idempotent.
-- ============================================================

ALTER TABLE public.story_requests
  ADD COLUMN IF NOT EXISTS failure_code  TEXT,
  ADD COLUMN IF NOT EXISTS failure_stage TEXT,
  ADD COLUMN IF NOT EXISTS retryable     BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_story_requests_failure_code
  ON public.story_requests (failure_code)
  WHERE failure_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_story_requests_status_failure_code
  ON public.story_requests (status, failure_code)
  WHERE status = 'failed';

NOTIFY pgrst, 'reload schema';
