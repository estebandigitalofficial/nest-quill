-- ============================================================
-- PROCESS-STORY SWEEP — backend scheduler (pg_cron + pg_net)
--
-- Every minute, ask the process-story Edge Function to run its
-- sweep mode: re-dispatch requests whose worker released them at the
-- time budget (and whose chained invocation was lost) or whose lease
-- expired (worker died), and fail rows with no progress for 30 min.
-- This is what makes story completion independent of the customer's
-- browser. The primary continuation path is the worker invoking
-- itself; this job is the safety net.
--
-- ONE MANUAL STEP BEFORE APPLYING (Supabase Studio → SQL editor):
--
--   select vault.create_secret(
--     '<EDGE_FUNCTION_SECRET or service-role key>',
--     'process_story_sweep_token',
--     'Bearer token the sweep cron sends to process-story'
--   );
--
-- The token must equal EDGE_FUNCTION_SECRET if that secret is set on
-- the function, otherwise the service-role key (see EXPECTED_TOKEN in
-- supabase/functions/process-story/index.ts). Never commit the value.
--
-- The function is deployed with verify_jwt = false (supabase/config.toml),
-- so the Authorization header below is checked by the function itself
-- (isAuthorizedBearer in policy.ts) — not by the API gateway. A wrong
-- token therefore yields HTTP 401 from the function, visible in
-- net._http_response (status_code = 401) and in the function logs
-- ("unauthorized — bearer rejected"); it is never silent.
--
-- The project URL is intentionally hard-coded: this repository is tied to
-- the single hosted project pejzpbyqaiajntndgavz and pg_cron has no access
-- to the function's environment. Change it here if the project ever moves.
--
-- Plan-independent: pg_cron and pg_net are available on every hosted
-- Supabase tier. Re-runnable: unschedules any previous copy first.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Fail loudly if the Vault secret is missing. Without this guard the job
-- would be scheduled with a NULL Authorization header and be rejected
-- (401) every minute while looking "installed".
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'process_story_sweep_token') THEN
    RAISE EXCEPTION 'Vault secret process_story_sweep_token is missing — create it (select vault.create_secret(...)) before applying 20240062';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-story-sweep') THEN
    PERFORM cron.unschedule('process-story-sweep');
  END IF;
END $$;

SELECT cron.schedule(
  'process-story-sweep',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pejzpbyqaiajntndgavz.supabase.co/functions/v1/process-story',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'process_story_sweep_token'
        LIMIT 1
      )
    ),
    body    := '{"mode":"sweep"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
