-- ============================================================
-- PRIVACY FOUNDATION 1 — step 3 of 3: drop the IP / geo columns
--
-- Removes the four columns added by 20240019_geo_tracking.sql from
-- story_requests. Application code stopped reading and writing them
-- in the same change that added this file; types/database.ts no
-- longer declares them. No index, view, trigger or SQL function in
-- production referenced them as of 2026-10-14.
--
-- RUN ONLY AFTER:
--   1. the application change is deployed to production, and
--   2. 20240070_story_requests_ip_geo_cleanup.sql has been applied.
--
-- Why a separate step: while the columns still exist, a rollback of
-- the Vercel deployment to the previous build keeps working (that
-- build inserts into these columns). Once they are dropped, the
-- previous build's story submission fails, so drop only when the
-- deploy is confirmed stable. Requires Founder authorization.
--
-- Idempotent. The schema reload lets PostgREST forget the columns.
-- ============================================================

ALTER TABLE public.story_requests
  DROP COLUMN IF EXISTS ip_address,
  DROP COLUMN IF EXISTS geo_city,
  DROP COLUMN IF EXISTS geo_country,
  DROP COLUMN IF EXISTS geo_region;

NOTIFY pgrst, 'reload schema';
