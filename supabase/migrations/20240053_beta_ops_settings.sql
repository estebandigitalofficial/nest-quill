-- ============================================================
-- BETA OPS — control-room settings
--
-- Seeds the app_settings keys that the /admin/beta-ops page reads
-- and toggles. ON CONFLICT DO NOTHING so re-running keeps any
-- admin-edited value.
--
-- ENFORCEMENT NOTE
-- These rows exist as the single source of truth for the beta
-- control room. Several toggles are display+control today and are
-- progressively wired to enforcement (story-creation gate, learning
-- tools gate, etc.) without further schema work. The values are
-- already safe to query from the existing /api/admin/app-settings
-- PATCH route.
-- ============================================================

INSERT INTO public.app_settings (key, value, category, label, description) VALUES
  ('story_creation_enabled',
   'true',
   'beta_ops', 'Story creation',
   'Master switch for /create. When off, the wizard renders a maintenance message instead of accepting submissions.'),
  ('guest_story_creation_enabled',
   'true',
   'beta_ops', 'Guest story creation',
   'Allow signed-out visitors to submit a story. Off → guests are nudged to sign up before the wizard accepts a submission.'),
  ('learning_tools_enabled',
   'true',
   'beta_ops', 'Learning tools',
   'Quizzes, flashcards, study helpers and the Learning toggle in the wizard. Off → /learning routes redirect to home.'),
  ('image_generation_enabled',
   'true',
   'beta_ops', 'Image generation',
   'When on (and beta is off), DALL·E generates illustrations for new stories. Beta mode independently pauses images for cost safety.'),
  ('support_tickets_enabled',
   'true',
   'beta_ops', 'Support intake',
   'Whether /contact accepts new tickets. Off → contact form shows a maintenance notice; admin still sees existing tickets.'),
  ('guided_tours_enabled',
   'true',
   'beta_ops', 'Guided tours',
   'Master switch for the guided tour overlay. Off → no auto-start, no replay link in the help menu.'),
  ('maintenance_banner_enabled',
   'false',
   'beta_ops', 'Maintenance banner',
   'When enabled, shows a site-wide banner with the message below.'),
  ('maintenance_banner_message',
   '"We''re making the experience even better. Hang tight!"',
   'beta_ops', 'Maintenance banner message',
   'Plain text shown in the maintenance banner. Quotes around the JSON value are required.')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
