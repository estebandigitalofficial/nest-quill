-- ============================================================
-- NOTIFICATIONS — bell-feed foundation
--
-- One row per delivered notification. user_id is NULL for system /
-- admin audience rows; for user audience the row belongs to that user.
-- Idempotent — safe to re-run.
--
-- RLS:
--   • SELECT: a user can read their own rows
--   • UPDATE: a user can update their own rows (in practice the API
--     only sets read_at; RLS can't restrict columns, so the route is
--     the trust boundary for what changes)
--   • INSERT/DELETE: no policy → service role only
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  audience    TEXT NOT NULL DEFAULT 'user'
              CHECK (audience IN ('user', 'admin', 'system')),
  type        TEXT NOT NULL,                    -- e.g. 'story_complete', 'classroom_assignment'
  title       TEXT NOT NULL,
  body        TEXT,
  href        TEXT,                             -- click target; nullable
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot path: bell open → recent unread for this user.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- General "show me my recent" path.
CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
