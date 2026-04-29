-- Enable RLS on all tables that were missing it.
--
-- All 8 tables below are accessed exclusively via createAdminClient() (service
-- role key), which bypasses RLS entirely. Enabling RLS with no permissive
-- policies is therefore safe: the service role still works, and the anon/
-- authenticated roles are blocked by default (Postgres deny-by-default).
--
-- The four tables the Supabase advisor flags as "publicly accessible":
--   writer_books, writer_chapters, writer_scenes, writer_scene_versions,
--   writer_book_sections, writer_copyright, admin_users, drip_email_log

ALTER TABLE writer_books          ENABLE ROW LEVEL SECURITY;
ALTER TABLE writer_chapters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE writer_scenes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE writer_scene_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE writer_book_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE writer_copyright      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_email_log        ENABLE ROW LEVEL SECURITY;

-- No permissive policies are added. RLS enabled + no policies = deny all
-- for anon/authenticated roles. Service role bypasses RLS so admin routes
-- are unaffected.
