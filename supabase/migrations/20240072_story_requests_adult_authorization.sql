-- ============================================================
-- PRIVACY FOUNDATION 2 — parent / guardian authorization evidence
--
-- Founder decision (2026-10-15): Nest & Quill is an adult-operated
-- product. Before a story is submitted for generation the adult user
-- affirms that they are an adult, that they are the child's parent or
-- legal guardian (or have that person's permission), and that they
-- have permission to include any other people named in the story.
-- The application (app/api/story/submit/route.ts) refuses to create a
-- story request without that affirmation; this migration adds the
-- columns that record it on the row that was created.
--
-- COLUMN DESIGN
--   adult_authorization_confirmed     BOOLEAN   NULL = never collected
--   adult_authorization_confirmed_at  TIMESTAMPTZ server time of submit
--   adult_authorization_version       TEXT      wording version shown
--
-- Why NULLABLE and not NOT NULL DEFAULT FALSE: every story_requests row
-- that exists before this migration was created before the affirmation
-- existed. Nobody affirmed anything for them, so the honest value is
-- "not collected" (NULL), never TRUE (fabricated consent) and never
-- FALSE (which would read as "declined"). The CHECK below is the only
-- shape a non-NULL value may take: TRUE together with its timestamp and
-- wording version. The server never inserts FALSE; a missing or false
-- affirmation is rejected before any row, entitlement or job exists.
--
-- Historical rows are therefore distinguishable from new rows by
-- adult_authorization_confirmed IS NULL. No UPDATE touches existing rows.
--
-- RLS: story_requests already has row level security with per-user
-- SELECT/INSERT policies (20240001). New columns inherit those row
-- policies; no policy change is needed, and the public client never
-- writes this table (the API route writes with the service role).
--
-- Not stored, by design (Privacy Foundation 1 stays intact): IP address,
-- geolocation, date of birth, identity documents, signatures, or the
-- legal text itself (the version string points at the wording in
-- lib/story/adultAuthorization.ts).
--
-- Forward only. Idempotent (IF NOT EXISTS guards). Apply by hand in
-- production BEFORE deploying the application change: the insert in
-- the submit route writes these columns, so a deploy ahead of the
-- migration would fail every story submission.
-- ============================================================

ALTER TABLE public.story_requests
  ADD COLUMN IF NOT EXISTS adult_authorization_confirmed    BOOLEAN,
  ADD COLUMN IF NOT EXISTS adult_authorization_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adult_authorization_version      TEXT;

COMMENT ON COLUMN public.story_requests.adult_authorization_confirmed IS
  'Adult/parent-guardian authorization affirmed at submit. NULL = row predates the affirmation (never collected); TRUE = affirmed. The API never writes FALSE.';
COMMENT ON COLUMN public.story_requests.adult_authorization_confirmed_at IS
  'Server timestamp of the submission that carried the affirmation.';
COMMENT ON COLUMN public.story_requests.adult_authorization_version IS
  'Version of the affirmation wording shown to the user (lib/story/adultAuthorization.ts).';

-- Evidence is all-or-nothing: either never collected (all NULL) or
-- affirmed with its timestamp and wording version.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'story_requests_adult_authorization_evidence_check'
       AND conrelid = 'public.story_requests'::regclass
  ) THEN
    ALTER TABLE public.story_requests
      ADD CONSTRAINT story_requests_adult_authorization_evidence_check CHECK (
        (adult_authorization_confirmed IS NULL
          AND adult_authorization_confirmed_at IS NULL
          AND adult_authorization_version IS NULL)
        OR
        (adult_authorization_confirmed = TRUE
          AND adult_authorization_confirmed_at IS NOT NULL
          AND adult_authorization_version IS NOT NULL)
      );
  END IF;
END $$;

-- Post-check (read-only). Immediately after applying, expect
-- affirmed = 0 and not_collected = total: nothing is backfilled.
-- SELECT count(*) AS total,
--        count(*) FILTER (WHERE adult_authorization_confirmed IS NULL) AS not_collected,
--        count(*) FILTER (WHERE adult_authorization_confirmed)         AS affirmed
--   FROM public.story_requests;
