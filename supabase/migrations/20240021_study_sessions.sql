-- ============================================================
-- STUDY SESSIONS — Study Helper tool completions
-- ============================================================
-- id is client-generated UUID; conflict = already processed
CREATE TABLE public.study_sessions (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('quiz','flashcards','explain','study-guide')),
  title_preview   TEXT,
  xp_awarded      SMALLINT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_study_sessions_user ON public.study_sessions (user_id, created_at DESC);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own study sessions"
  ON public.study_sessions FOR SELECT USING (user_id = auth.uid());
