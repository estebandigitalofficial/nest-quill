-- ============================================================
-- BETA MODE DECOUPLING — settings copy only
--
-- beta_mode_enabled no longer skips illustrations or PDF assembly.
-- Illustrations follow image_generation_enabled (+ the worker's
-- SKIP_IMAGE_GENERATION secret); PDFs follow pdf_download_enabled
-- + plan entitlement + completion. This migration only corrects the
-- admin-facing descriptions so the Settings / Beta Ops pages tell
-- the truth. No behavioural change lives in SQL.
--
-- Idempotent: plain UPDATEs on existing rows.
-- ============================================================

UPDATE public.app_settings
SET description = 'When enabled: bypasses guest/free/paid story limits for beta testing and switches public copy to "free during beta". Does NOT affect illustrations or PDFs — use "Image generation" and "PDF Download" for those.'
WHERE key = 'beta_mode_enabled';

UPDATE public.app_settings
SET description = 'When on, DALL·E generates illustrations for new stories regardless of Beta Mode. Turn off to pause illustration spend; stories then complete as text-only with honest placeholders.'
WHERE key = 'image_generation_enabled';

UPDATE public.app_settings
SET description = 'Allow entitled (non-free) plans to download their story as a PDF. Independent of Beta Mode. The PDF is assembled lazily on the first visit to a completed story.'
WHERE key = 'pdf_download_enabled';

NOTIFY pgrst, 'reload schema';
