-- ============================================================
-- SUPPORT TICKETS — beta-grade ticket inbox
--
-- Idempotent. Inserts come from the contact form and (later) any
-- support widget. Admin reads + writes use the service-role client.
-- Users may insert their own ticket; reads are admin-only for now
-- (no end-user "my tickets" view in this iteration).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email                TEXT NOT NULL,
  name                 TEXT,
  subject              TEXT NOT NULL,
  message              TEXT NOT NULL,
  category             TEXT,
  priority             TEXT NOT NULL DEFAULT 'normal'
                       CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status               TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  source               TEXT NOT NULL DEFAULT 'contact_form',
  related_story_id     UUID,
  related_classroom_id UUID,
  assigned_to          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
  ON public.support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_priority_created
  ON public.support_tickets (priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON public.support_tickets (user_id, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests, anon role) can submit a ticket.
DROP POLICY IF EXISTS "support_tickets_insert_anyone" ON public.support_tickets;
CREATE POLICY "support_tickets_insert_anyone"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (true);

-- Authenticated users can read their own tickets (future user-facing UI).
DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
CREATE POLICY "support_tickets_select_own"
  ON public.support_tickets
  FOR SELECT
  USING (auth.uid() = user_id);

-- UPDATE / DELETE deliberately have no policy → service role only.

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.closed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_support_tickets_updated_at();

NOTIFY pgrst, 'reload schema';
