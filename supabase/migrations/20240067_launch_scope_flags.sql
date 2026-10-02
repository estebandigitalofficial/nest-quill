-- ============================================================
-- LAUNCH SCOPE (Phase 2A) — one public flag per deferred product area
--
-- The current public launch is personalized children's books only.
-- Classroom, Homeschool, Learning Tools, Writer Studio and the teen/adult
-- audiences stay in the codebase and are shown to the public only while
-- their flag is true (lib/launch/scope.ts). Admin surfaces are not
-- affected by these flags. Flip a flag in Admin → Beta Ops to restore an
-- area; no code change is needed.
--
-- Idempotent: seeds missing rows, and sets the launch values once.
-- ============================================================

INSERT INTO public.app_settings (key, value, category, label, description) VALUES
  ('homeschool_enabled', 'false', 'flags', 'Homeschool (public)',
   'Show the Homeschool section and routes to the public. Off for the children''s-book launch.'),
  ('writer_studio_enabled', 'false', 'flags', 'Writer Studio (public)',
   'Show Writer Studio navigation and routes to the public. Off for the children''s-book launch.'),
  ('extended_audiences_enabled', 'false', 'flags', 'Teen & adult audiences (public wizard)',
   'Offer teen and adult audiences (and the 18+ consent flow) in the public story wizard. Off for the children''s-book launch; the validators and data model keep supporting them.')
ON CONFLICT (key) DO NOTHING;

-- Launch values for the pre-existing area flags.
UPDATE public.app_settings SET value = 'false', description = 'Show the Classroom section and all educator-facing flows to the public. Off for the children''s-book launch.'
WHERE key = 'classroom_enabled' AND value = 'true';

UPDATE public.app_settings SET value = 'false', description = 'Quizzes, flashcards, study helpers and the Learning toggle in the wizard. Off for the children''s-book launch.'
WHERE key = 'learning_tools_enabled' AND value = 'true';

NOTIFY pgrst, 'reload schema';
