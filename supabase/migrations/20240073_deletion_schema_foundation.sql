-- ============================================================
-- PRIVACY FOUNDATION 3B-1 — deletion schema foundation
--
-- Schema only. No story or account deletion exists yet; this migration
-- makes the database safe for the deletion workflows that follow
-- (3B-2 onwards) and gives them a place to leave operational evidence.
--
-- Founder decisions (2026-10-15):
--
--   1. Commercial records survive account deletion. Today
--      story_purchases.user_id and subscription_periods.user_id are
--      NOT NULL with ON DELETE CASCADE from auth.users, so deleting an
--      account destroys the payment / entitlement history. Both columns
--      become nullable and their foreign keys become ON DELETE SET NULL.
--      Every other column, constraint, index and row is kept. Nothing
--      about purchase status, allowance arithmetic, refunds or Stripe
--      changes: the reservation functions in 20240068 already match on
--      user_id = p_user_id, so a detached row (user_id IS NULL) can never
--      be consumed by anyone.
--
--   2. A deletion audit record may be kept, holding minimal operational
--      evidence only: what kind of thing was deleted, its opaque id, who
--      asked (by type, and by auth user id where one exists), when it
--      started and finished, how it ended, and bounded completion counts.
--      It never holds a child's name or description, story text, prompts,
--      dedications, supporting characters, customer email, IP address,
--      location, guest token, Stripe payload, or any free-text field
--      where such data could be pasted. The counts column is JSONB only
--      so future workflows can add a counter without a migration, and a
--      CHECK function restricts it to an allow-list of keys with
--      non-negative integer values.
--
--   3. No deleted-user correlation column is added (see the completion
--      report, section 9). A row with user_id IS NULL is, by construction,
--      a row whose account was deleted: both tables are only ever written
--      with a user_id. Commercial lookups keep working through the Stripe
--      ids already on the rows; proof that a deletion happened lives in
--      deletion_log. No email, email hash or other reversible identifier
--      is stored for deleted accounts.
--
--   4. Untouched on purpose: story_requests.guest_token values (claimed
--      stories keep both user_id and guest_token until claim semantics
--      are settled) and the must_have_owner CHECK (declared in 20240001,
--      absent from production). Neither is read or written here.
--
-- Safety: forward only, idempotent, additive except for the two
-- NOT NULL drops and the two ON DELETE changes. Contains no UPDATE,
-- DELETE, TRUNCATE or DROP of any table or column. Safe to run against
-- the production schema whether or not the FK constraint names match
-- the defaults (they are discovered from the catalog). Apply by hand in
-- the Supabase SQL Editor; do not apply until the Founder authorizes it.
-- ============================================================

-- ── 1. story_purchases: nullable owner, SET NULL on account delete ──
ALTER TABLE public.story_purchases
  ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  v_name    TEXT;
  v_action  "char";
BEGIN
  SELECT c.conname, c.confdeltype INTO v_name, v_action
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
   WHERE c.conrelid  = 'public.story_purchases'::regclass
     AND c.contype   = 'f'
     AND c.confrelid = 'auth.users'::regclass
     AND array_length(c.conkey, 1) = 1
     AND a.attname   = 'user_id';

  IF v_name IS NOT NULL AND v_action <> 'n' THEN
    EXECUTE format('ALTER TABLE public.story_purchases DROP CONSTRAINT %I', v_name);
    v_name := NULL;
  END IF;

  IF v_name IS NULL THEN
    ALTER TABLE public.story_purchases
      ADD CONSTRAINT story_purchases_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.story_purchases.user_id IS
  'Owning account. NULL only after that account was deleted (ON DELETE SET NULL); the purchase row is retained as a commercial record and can no longer be consumed.';

-- ── 2. subscription_periods: nullable owner, SET NULL on account delete ──
ALTER TABLE public.subscription_periods
  ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  v_name    TEXT;
  v_action  "char";
BEGIN
  SELECT c.conname, c.confdeltype INTO v_name, v_action
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
   WHERE c.conrelid  = 'public.subscription_periods'::regclass
     AND c.contype   = 'f'
     AND c.confrelid = 'auth.users'::regclass
     AND array_length(c.conkey, 1) = 1
     AND a.attname   = 'user_id';

  IF v_name IS NOT NULL AND v_action <> 'n' THEN
    EXECUTE format('ALTER TABLE public.subscription_periods DROP CONSTRAINT %I', v_name);
    v_name := NULL;
  END IF;

  IF v_name IS NULL THEN
    ALTER TABLE public.subscription_periods
      ADD CONSTRAINT subscription_periods_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.subscription_periods.user_id IS
  'Owning account. NULL only after that account was deleted (ON DELETE SET NULL); the period row is retained as a commercial record and can no longer be drawn from.';

-- ── 3. deletion_log: minimal operational evidence ───────────
-- Bounded counts: an object whose keys come from the allow-list below
-- and whose values are non-negative integers. Nothing else fits.
CREATE OR REPLACE FUNCTION public.deletion_log_counts_ok(p JSONB)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT jsonb_typeof(p) = 'object'
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_each(p) AS kv
        WHERE kv.key NOT IN (
                'storage_objects',          -- files removed from story-images / book-exports
                'story_requests',           -- story rows removed
                'generated_stories',
                'story_scenes',
                'book_exports',
                'delivery_logs',
                'processing_logs',
                'image_library',
                'idempotency_keys',
                'drip_email_log',
                'notifications',
                'support_tickets',
                'stories_deleted',          -- account deletion: child deletions run
                'purchases_detached',       -- account deletion: rows left with user_id NULL
                'subscription_periods_detached'
              )
           OR jsonb_typeof(kv.value) <> 'number'
           OR (kv.value)::text !~ '^[0-9]{1,9}$'
     );
$$;

CREATE TABLE IF NOT EXISTS public.deletion_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What was deleted.
  deletion_type  TEXT        NOT NULL CHECK (deletion_type IN ('story', 'account')),
  -- Opaque id of the subject: story_requests.id or auth.users.id. No FK on
  -- purpose: the subject row is gone once the deletion completes, and this
  -- row is the evidence that it is gone.
  subject_id     UUID        NOT NULL,
  -- Story deletions that run as part of an account deletion point at the
  -- account's row, so completion can be checked per account.
  parent_id      UUID        REFERENCES public.deletion_log(id) ON DELETE RESTRICT,
  -- Who asked. actor_id is the acting auth user where one exists (the
  -- customer themselves, or an admin). No FK: for a self-service account
  -- deletion the actor IS the subject and is deleted, and the evidence of
  -- who asked must survive that. NULL for the system (reconciliation) and
  -- for guests, who have no account.
  actor_type     TEXT        NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system')),
  actor_id       UUID,
  -- Lifecycle.
  status         TEXT        NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  -- Bounded machine code for a failure (never a message, never a stack).
  failure_code   TEXT        CHECK (failure_code IS NULL OR failure_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  -- Completion counts, allow-listed keys, non-negative integers only.
  counts         JSONB       NOT NULL DEFAULT '{}'::jsonb CHECK (public.deletion_log_counts_ok(counts)),

  CONSTRAINT deletion_log_actor_shape CHECK (
    (actor_type = 'system' AND actor_id IS NULL)
    OR (actor_type = 'admin' AND actor_id IS NOT NULL)
    OR (actor_type = 'customer')
  ),
  CONSTRAINT deletion_log_lifecycle_shape CHECK (
    (status = 'started'   AND completed_at IS NULL     AND failure_code IS NULL)
    OR (status = 'completed' AND completed_at IS NOT NULL AND failure_code IS NULL)
    OR (status = 'failed'    AND completed_at IS NOT NULL AND failure_code IS NOT NULL)
  ),
  CONSTRAINT deletion_log_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id)
);

COMMENT ON TABLE public.deletion_log IS
  'Operational evidence that a story or account deletion ran. Holds opaque ids, actor type, timestamps, status and bounded counts only. Never holds child data, story content, prompts, email, IP, location, guest tokens or payloads. Service role only.';
COMMENT ON COLUMN public.deletion_log.subject_id IS
  'story_requests.id for deletion_type = story; auth.users.id for deletion_type = account. Not a foreign key: the subject no longer exists once the row is completed.';
COMMENT ON COLUMN public.deletion_log.actor_id IS
  'auth.users.id of the person who asked (customer or admin). NULL for system runs and for guests. Not a foreign key so the evidence survives the actor''s own account deletion.';
COMMENT ON COLUMN public.deletion_log.counts IS
  'Completion counts. Keys restricted to the allow-list in deletion_log_counts_ok(); values are non-negative integers.';

-- One live or completed record per subject: a second attempt on the same
-- story or account must find the first one (idempotency), while a failed
-- attempt may be retried with a new row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deletion_log_subject_active
  ON public.deletion_log (deletion_type, subject_id)
  WHERE status IN ('started', 'completed');

CREATE INDEX IF NOT EXISTS idx_deletion_log_started_at
  ON public.deletion_log (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_log_parent_id
  ON public.deletion_log (parent_id)
  WHERE parent_id IS NOT NULL;

-- Access: service role only, the same model as stripe_webhook_events.
-- RLS is on with a single policy that admits only the service role, and
-- the API roles lose their table privileges outright, so even a future
-- permissive policy could not make the table client-writable. The
-- Next.js server reads and writes it through the admin client; browser
-- clients never see it.
ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.deletion_log FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.deletion_log_counts_ok(JSONB) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.deletion_log_counts_ok(JSONB) TO service_role;

DROP POLICY IF EXISTS deletion_log_service_role_only ON public.deletion_log;
CREATE POLICY deletion_log_service_role_only ON public.deletion_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Reload PostgREST schema cache so the new table and column changes are
-- visible to the admin client.
NOTIFY pgrst, 'reload schema';

-- Post-check (read-only). Immediately after applying, expect:
--   both user_id columns is_nullable = YES, both FKs ON DELETE SET NULL,
--   deletion_log present with 0 rows, RLS on, exactly one policy,
--   no grants to anon/authenticated, and the row counts of
--   story_purchases / subscription_periods / story_requests unchanged.
-- The exact query is in the completion report (section 20).
