-- ============================================================
-- WRITER STUDIO — source documents (Phase 1: storage foundation)
--
-- Lets users attach source files (PDF / DOCX / TXT) to their Writer
-- Studio projects. These become the future knowledge/reference base:
--   Phase 2 — PDF text extraction
--   Phase 3 — source chunk storage
--   Phase 4 — source-aware writing
--   Phase 5 — citations / references
-- This phase only stores the file and its metadata. No processing,
-- extraction, embeddings, or AI. Admin Writer is untouched.
-- ============================================================

CREATE TABLE public.writer_project_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.writer_projects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 300),
  file_type     TEXT NOT NULL,                       -- MIME type as reported on upload
  file_size     BIGINT NOT NULL CHECK (file_size >= 0),
  storage_path  TEXT NOT NULL,                       -- path within the writer-project-files bucket
  -- Forward-looking status set: 'uploaded' is the terminal state for Phase 1.
  -- Later phases use 'processing' / 'processed' as extraction lands.
  upload_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (upload_status IN (
                  'pending', 'uploaded', 'processing', 'processed', 'failed'
                )),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_writer_project_files_project ON public.writer_project_files (project_id, created_at DESC);
CREATE INDEX idx_writer_project_files_user ON public.writer_project_files (user_id);

-- ── Table RLS ──────────────────────────────────────────────────
-- Users may only see/manage rows they own. WITH CHECK on insert blocks
-- attaching files under another user's id.
ALTER TABLE public.writer_project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own writer project files"
  ON public.writer_project_files FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Private storage bucket ─────────────────────────────────────
-- Private (like story-images / book-exports). Allowed types: PDF, DOCX, TXT.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'writer-project-files',
  'writer-project-files',
  FALSE,
  26214400,  -- 25MB per file
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ────────────────────────────────────────────────
-- Objects are namespaced as "<user_id>/<project_id>/<file_id>.<ext>", so the
-- first path segment is the owner. Authenticated users may only read/write/
-- delete objects under their own user-id folder in this bucket.
CREATE POLICY "Users read own writer project files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'writer-project-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users upload own writer project files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'writer-project-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own writer project files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'writer-project-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
