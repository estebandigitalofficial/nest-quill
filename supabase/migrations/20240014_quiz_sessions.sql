-- Quiz sessions: server-side answer storage so correct_index never reaches the client
CREATE TABLE public.quiz_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questions     JSONB NOT NULL,           -- full questions WITH correct_index (never sent to client)
  subject       TEXT,
  grade         SMALLINT,
  topic         TEXT,
  source        TEXT NOT NULL DEFAULT 'standalone', -- 'standalone' | 'story'
  source_id     UUID,                     -- story request_id when source = 'story'
  attempt_count SMALLINT NOT NULL DEFAULT 0,
  max_attempts  SMALLINT NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  min_seconds   SMALLINT NOT NULL DEFAULT 60, -- minimum seconds to complete (anti-speedrun)
  started_at    TIMESTAMPTZ,             -- set when client signals quiz start
  ip_address    TEXT,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_token   TEXT,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_sessions_expires  ON public.quiz_sessions (expires_at);
CREATE INDEX idx_quiz_sessions_source   ON public.quiz_sessions (source_id) WHERE source_id IS NOT NULL;
CREATE INDEX idx_quiz_sessions_ip       ON public.quiz_sessions (ip_address, created_at);

ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to quiz_sessions"
  ON public.quiz_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
