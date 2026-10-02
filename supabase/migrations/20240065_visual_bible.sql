-- ============================================================
-- VISUAL BIBLE — book-level illustration continuity (Phase 1E)
--
-- story_requests.visual_bible   deterministic, internal design record
--                                (protagonist anchor, supporting-character
--                                anchors, setting, art direction) built once
--                                per story from the validated plan and the
--                                request, then reused by every page, every
--                                continuation and every image-only retry.
--                                Not customer-facing.
--
-- story_scenes.image_model / image_revised_prompt / generation_attempts
-- (exist since 20240001) now receive values from the worker.
--
-- The worker tolerates the column being absent: the bible is rebuilt
-- deterministically from the same inputs, so continuity does not depend
-- on this migration — persistence is for debugging and later cover work.
-- ============================================================

ALTER TABLE public.story_requests
  ADD COLUMN IF NOT EXISTS visual_bible JSONB;

COMMENT ON COLUMN public.story_requests.visual_bible IS
  'Internal illustration continuity record (Phase 1E). Generation metadata; not customer-facing.';

INSERT INTO public.ai_writer_config (key, value, description) VALUES
  ('image_consistency_rules',
   'Same illustrated book on every page: identical character designs, proportions and outfits unless a page note says otherwise; one consistent medium, palette and level of detail; compositions may vary freely (wide, close, action, quiet) to suit the moment.',
   'Book-level consistency rule appended to every illustration prompt (Phase 1E). Code keeps an identical fallback.')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
