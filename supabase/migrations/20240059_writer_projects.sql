-- ============================================================
-- WRITER STUDIO — customer-facing structured writing projects
--
-- Public companion to the internal Admin Writer (writer_books /
-- writer_chapters / writer_scenes), which is intentionally left
-- untouched. Writer Studio projects are owned by end users and
-- support multiple document types (book, manual, handbook, SOP,
-- training guide, curriculum, workbook).
--
-- Foundation only: outline/content/settings are flexible jsonb so
-- the generation pipeline can fill them in later. No AI generation
-- or source-document upload is wired up here.
-- ============================================================

CREATE TABLE public.writer_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Untitled project'
                  CHECK (char_length(title) BETWEEN 1 AND 200),
  document_type TEXT NOT NULL CHECK (document_type IN (
                  'book', 'manual', 'handbook', 'sop',
                  'training_guide', 'curriculum', 'workbook'
                )),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                  'draft', 'in_progress', 'complete', 'archived'
                )),
  outline       JSONB NOT NULL DEFAULT '[]'::jsonb,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_writer_projects_user
  ON public.writer_projects (user_id, updated_at DESC);

CREATE TRIGGER writer_projects_updated_at
  BEFORE UPDATE ON public.writer_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
-- Users may only read/write their own projects. The service-role
-- client (createAdminClient) bypasses RLS, so admin routes can read
-- across all users without a dedicated policy.
ALTER TABLE public.writer_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own writer projects"
  ON public.writer_projects FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
