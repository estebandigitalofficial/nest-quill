-- ============================================================
-- PRIVACY FOUNDATION 1 — step 2 of 3: historical IP / geo cleanup
--
-- Founder decision (2026-10-14): Nest & Quill does not keep a raw IP
-- address or IP-derived city/region/country on a customer's story
-- record. Application writes stopped in the same change that added
-- this file (app/api/story/submit/route.ts no longer sets these
-- fields). This migration removes the values already stored.
--
-- ORDER OF OPERATIONS (do not reorder):
--   1. Deploy the application change that stops writing these fields.
--   2. Run this migration (nulls historical values; columns remain).
--   3. Run 20240071_story_requests_drop_ip_geo.sql once the deploy is
--      confirmed stable (drops the four columns).
--
-- This is a DATA change to production customer rows. It is forward
-- only and cannot be undone: once nulled, the values are gone. It
-- requires explicit Founder authorization before it is applied.
-- Measured on 2026-10-14 (aggregate counts only): 29 story_requests
-- rows, 15 with ip_address, 14 with geo_city, 15 with geo_region,
-- 15 with geo_country. Re-check with the SELECT below before running.
--
-- Idempotent: re-running after the columns are dropped is a no-op
-- because every statement is guarded on column existence.
-- ============================================================

-- Pre-check (read-only). Expect the four "with_*" counts to be > 0
-- before the update and 0 after it.
-- SELECT count(*) AS total,
--        count(ip_address) AS with_ip,
--        count(geo_city)   AS with_city,
--        count(geo_region) AS with_region,
--        count(geo_country) AS with_country
--   FROM public.story_requests;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'story_requests'
       AND column_name IN ('ip_address', 'geo_city', 'geo_region', 'geo_country')
  ) THEN
    UPDATE public.story_requests
       SET ip_address  = NULL,
           geo_city    = NULL,
           geo_region  = NULL,
           geo_country = NULL
     WHERE ip_address  IS NOT NULL
        OR geo_city    IS NOT NULL
        OR geo_region  IS NOT NULL
        OR geo_country IS NOT NULL;
  END IF;
END $$;
