-- ============================================================
-- PRIVACY FOUNDATION 3C-1 — failed-story deletion database foundation
--
-- Database only. No route, UI, worker or storage code calls anything in
-- this file yet (3C-2 onwards). Applying it changes NO customer data: no
-- backfill, no UPDATE/DELETE of existing rows, no storage change. It adds
-- one nullable column, one CHECK constraint and four functions, replaces
-- two reservation functions with stricter predicates, and closes the
-- EXECUTE exposure of the entitlement functions created by 20240068.
--
-- Founder decisions (2026-10-15 17:15 UTC), implemented here:
--   D1 any archived failed story may be deleted after server-side checks;
--   D2 an eligible unused Free allowance is returned during deletion
--      (release_free_reservation); paid credits are never auto-restored;
--   D3 consumed purchases are protected with EXPLICIT reservation-state
--      semantics, not a time cutoff (consumed_request_id + CHECK below);
--   D4 adult-authorization evidence goes with the row; only the minimal
--      deletion_log record (20240073) is kept;
--   D5 atomic database deletion first, storage cleanup second.
--
-- ── Purchase reservation state (D3) ──────────────────────────
-- A story_purchases row moves through:
--   paid       → unused entitlement (findPaidPurchase / reserve_purchase)
--   consumed, request_id NULL, consumed_request_id NULL
--              → PENDING reservation: reserve_purchase succeeded and the
--                story row is about to be inserted; release_purchase may
--                undo it if that insert fails
--   consumed, request_id = <story>
--              → ATTACHED to the story it paid for
--   consumed, request_id NULL, consumed_request_id = <deleted story>
--              → DETACHED: the story was permanently deleted. TERMINAL.
-- Before this migration a pending and a detached row were identical, so a
-- rollback could silently restore a purchase whose story had been deleted.
-- The CHECK story_purchases_detached_terminal makes the detached state
-- terminal for EVERY caller (functions, application code, manual SQL):
-- such a row can never return to paid, never carry a request_id again,
-- and therefore can never be selected, reserved, attached or released.
--
-- ── delete_failed_story outcomes ─────────────────────────────
--   not_found        unknown id, another user's story, or another user's
--                    deletion record (all byte-identical: no existence leak)
--   not_eligible     own live story that is not archived+failed+quiescent
--   deleted          row removed in this transaction; storage cleanup next
--   deleted+resumed  row already gone, own deletion_log row still 'started'
--                    (storage cleanup did not finish): re-run the cleanup
--   already_deleted  own deletion_log row is 'completed'
--
-- ── Entitlement RPC boundary ─────────────────────────────────
-- Every function below is called only through the server-side service-role
-- client (lib/entitlements/supabaseStore.ts, lib/entitlements/freeRelease.ts,
-- app/auth/callback, app/api/story/{claim,status}, app/api/admin/reporting,
-- app/admin/reporting, supabase/functions/process-story). None is called
-- from a browser client, so PUBLIC/anon/authenticated EXECUTE (the Postgres
-- default these functions inherited) is removed.
--
-- Idempotent and forward only. Apply by hand in the Supabase SQL Editor
-- after the read-only preflight in the completion report; do not apply
-- until the Founder authorizes it.
-- ============================================================

-- ── 1. story_purchases.consumed_request_id ───────────────────
ALTER TABLE public.story_purchases
  ADD COLUMN IF NOT EXISTS consumed_request_id UUID;

COMMENT ON COLUMN public.story_purchases.consumed_request_id IS
  'Set when the story this purchase paid for was permanently deleted (the deleted story id; no FK, the story is gone). A row with this column set is terminal: it can never return to paid, be attached to another story, be reserved or be released.';

-- ── 2. Detached purchases are terminal (D3) ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.story_purchases'::regclass
       AND conname  = 'story_purchases_detached_terminal'
  ) THEN
    ALTER TABLE public.story_purchases
      ADD CONSTRAINT story_purchases_detached_terminal
      CHECK (consumed_request_id IS NULL OR (request_id IS NULL AND status <> 'paid'));
  END IF;
END $$;

-- ── 3. reserve_purchase: 20240068 behaviour + detached rows excluded ──
CREATE OR REPLACE FUNCTION public.reserve_purchase(p_purchase_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    UPDATE public.story_purchases SET status = 'consumed', consumed_at = now()
    WHERE id = p_purchase_id AND user_id = p_user_id AND status = 'paid' AND request_id IS NULL
      AND consumed_request_id IS NULL
    RETURNING id
  ) SELECT EXISTS (SELECT 1 FROM u);
$$;

-- ── 4. release_purchase: compensation only, never for a detached row ──
-- Only a PENDING reservation (consumed, no request_id, never detached) can
-- go back to paid. A purchase whose story was deleted stays consumed.
CREATE OR REPLACE FUNCTION public.release_purchase(p_purchase_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.story_purchases SET status = 'paid', consumed_at = NULL
  WHERE id = p_purchase_id AND status = 'consumed' AND request_id IS NULL
    AND consumed_request_id IS NULL;
$$;

-- ── 5. delete_failed_story ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_failed_story(p_request_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row            public.story_requests%ROWTYPE;
  v_log_id         UUID;
  v_log_status     TEXT;
  v_log_actor_type TEXT;
  v_log_actor_id   UUID;
  v_free_released  BOOLEAN := false;
  v_known_paths    JSONB;
  v_counts         JSONB;
  v_n              INTEGER;
  v_generated      INTEGER;
  v_scenes         INTEGER;
  v_exports        INTEGER;
  v_deliveries     INTEGER;
  v_processing     INTEGER;
  v_images         INTEGER;
  v_purchases      INTEGER;
  v_idem           INTEGER;
  v_drips          INTEGER;
  v_notes          INTEGER;
BEGIN
  -- Customers only (3C scope). Guests and system callers have no account id.
  IF p_request_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  -- A. Lock the story row if it still exists. Concurrent callers queue here;
  --    after the winner commits, the loser's locked read sees no row and
  --    falls into the no-row branch below.
  SELECT * INTO v_row FROM public.story_requests WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    -- No row. Only the requester's own active deletion record is
    -- acknowledged; anything else is indistinguishable from an unknown id.
    -- uq_deletion_log_subject_active guarantees at most one such record.
    SELECT id, status, actor_type, actor_id
      INTO v_log_id, v_log_status, v_log_actor_type, v_log_actor_id
      FROM public.deletion_log
     WHERE deletion_type = 'story'
       AND subject_id = p_request_id
       AND status IN ('started', 'completed');

    IF NOT FOUND
       OR v_log_actor_type <> 'customer'
       OR v_log_actor_id IS DISTINCT FROM p_user_id THEN
      RETURN jsonb_build_object('outcome', 'not_found');
    END IF;

    IF v_log_status = 'completed' THEN
      RETURN jsonb_build_object('outcome', 'already_deleted', 'log_id', v_log_id);
    END IF;

    -- 'started': the row is gone but storage cleanup never completed.
    -- The caller re-lists both bucket prefixes and completes the record.
    RETURN jsonb_build_object(
      'outcome', 'deleted', 'resumed', true, 'log_id', v_log_id,
      'known_paths', '[]'::jsonb, 'counts', '{}'::jsonb, 'free_released', false
    );
  END IF;

  -- Another user's live story: same answer as an unknown id.
  IF v_row.user_id IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  -- Eligibility (D1) and quiescence: archived, failed, no worker holds the
  -- row, and nothing has written to it for 3 minutes (longer than one Edge
  -- invocation can live on the current plan; see policy.ts HARD_LIMIT_MS).
  -- Checked under the row lock, so a retry or restore that lands later
  -- finds no row (or finds it unchanged and this call returns not_eligible).
  IF v_row.archived_at IS NULL
     OR v_row.status <> 'failed'
     OR v_row.worker_id IS NOT NULL
     OR v_row.updated_at >= now() - interval '3 minutes' THEN
    RETURN jsonb_build_object('outcome', 'not_eligible');
  END IF;

  -- B. Evidence. An active record cannot exist for a live story (records
  --    are only created here, in the same transaction that deletes the
  --    row), so a unique_violation would reveal a broken invariant: let it
  --    raise rather than hide it.
  INSERT INTO public.deletion_log (deletion_type, subject_id, actor_type, actor_id, status)
  VALUES ('story', p_request_id, 'customer', p_user_id, 'started')
  RETURNING id INTO v_log_id;

  -- C. D2: give back an unused Free allowance. The function enforces
  --    free-only, account-owned, failed, never completed, once-only.
  --    Deletion is the terminal event, so no retry-eligibility test applies.
  v_free_released := COALESCE(public.release_free_reservation(p_request_id), false);

  -- D. D3: detach the purchase explicitly, in ONE statement so the CHECK
  --    holds at every statement boundary. The FK ON DELETE SET NULL on
  --    request_id then has nothing left to do.
  UPDATE public.story_purchases
     SET consumed_request_id = request_id, request_id = NULL
   WHERE request_id = p_request_id;
  GET DIAGNOSTICS v_purchases = ROW_COUNT;

  -- E. Storage objects the row knows about (the caller unions these with a
  --    prefix listing of <id>/ in both buckets, so legacy .png leftovers and
  --    objects a stale worker uploaded late are removed too).
  SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'path', path)), '[]'::jsonb)
    INTO v_known_paths
    FROM (
      SELECT COALESCE(s.storage_bucket, 'story-images') AS bucket, s.storage_path AS path
        FROM public.story_scenes s
       WHERE s.request_id = p_request_id AND s.storage_path IS NOT NULL
      UNION
      SELECT 'story-images', g.cover_storage_path
        FROM public.generated_stories g
       WHERE g.request_id = p_request_id AND g.cover_storage_path IS NOT NULL
      UNION
      SELECT COALESCE(b.storage_bucket, 'book-exports'), b.storage_path
        FROM public.book_exports b
       WHERE b.request_id = p_request_id AND b.storage_path IS NOT NULL
    ) k;

  -- F. Row counts for the evidence record, captured before the cascade.
  SELECT count(*) INTO v_generated  FROM public.generated_stories WHERE request_id = p_request_id;
  SELECT count(*) INTO v_scenes     FROM public.story_scenes      WHERE request_id = p_request_id;
  SELECT count(*) INTO v_exports    FROM public.book_exports      WHERE request_id = p_request_id;
  SELECT count(*) INTO v_deliveries FROM public.delivery_logs     WHERE request_id = p_request_id;
  SELECT count(*) INTO v_processing FROM public.processing_logs   WHERE request_id = p_request_id;
  SELECT count(*) INTO v_images     FROM public.image_library     WHERE request_id = p_request_id;

  -- G. References that have no foreign key to the story.
  DELETE FROM public.idempotency_keys WHERE request_id = p_request_id;
  GET DIAGNOSTICS v_idem = ROW_COUNT;
  DELETE FROM public.drip_email_log WHERE reference_id = p_request_id::text;
  GET DIAGNOSTICS v_drips = ROW_COUNT;
  DELETE FROM public.notifications WHERE href = '/story/' || p_request_id::text;
  GET DIAGNOSTICS v_notes = ROW_COUNT;

  -- H. The story row. ON DELETE CASCADE removes generated_stories,
  --    story_scenes, book_exports, delivery_logs, processing_logs,
  --    image_library and the deferred-product child rows.
  DELETE FROM public.story_requests WHERE id = p_request_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  v_counts := jsonb_build_object(
    'story_requests',     v_n,
    'generated_stories',  v_generated,
    'story_scenes',       v_scenes,
    'book_exports',       v_exports,
    'delivery_logs',      v_deliveries,
    'processing_logs',    v_processing,
    'image_library',      v_images,
    'purchases_detached', v_purchases,
    'idempotency_keys',   v_idem,
    'drip_email_log',     v_drips,
    'notifications',      v_notes
  );

  RETURN jsonb_build_object(
    'outcome', 'deleted', 'resumed', false, 'log_id', v_log_id,
    'known_paths', v_known_paths, 'counts', v_counts, 'free_released', v_free_released
  );
END;
$$;

COMMENT ON FUNCTION public.delete_failed_story(UUID, UUID) IS
  'Atomically deletes an archived failed story owned by p_user_id (eligibility, deletion_log started, Free release, purchase detach, FK-less cleanups, row delete) and returns the storage paths to remove. Repeat calls are recognised through deletion_log.actor_id. Service role only.';

-- ── 6. complete_story_deletion ───────────────────────────────
-- started → completed only. counts must satisfy deletion_log_counts_ok()
-- (the table CHECK from 20240073 enforces it). Idempotent: false when the
-- record is not in 'started'.
CREATE OR REPLACE FUNCTION public.complete_story_deletion(p_log_id UUID, p_counts JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.deletion_log
     SET status = 'completed', completed_at = now(), counts = COALESCE(p_counts, '{}'::jsonb)
   WHERE id = p_log_id AND status = 'started';
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.complete_story_deletion(UUID, JSONB) IS
  'Marks a started deletion_log record completed with bounded counts after storage cleanup. Service role only.';

-- ── 7. Grants: new functions are service-role only ───────────
REVOKE ALL ON FUNCTION public.delete_failed_story(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_failed_story(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.delete_failed_story(UUID, UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_failed_story(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.complete_story_deletion(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_story_deletion(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.complete_story_deletion(UUID, JSONB) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.complete_story_deletion(UUID, JSONB) TO service_role;

-- ── 8. Grants: entitlement RPC boundary (server-only callers) ─
REVOKE ALL ON FUNCTION public.reserve_purchase(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_purchase(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_purchase(UUID, UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reserve_purchase(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.release_purchase(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_purchase(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.release_purchase(UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.release_purchase(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_subscription_unit(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_subscription_unit(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_subscription_unit(UUID, UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reserve_subscription_unit(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.release_subscription_unit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_subscription_unit(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.release_subscription_unit(UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.release_subscription_unit(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_free_book(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_free_book(UUID, INT) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_free_book(UUID, INT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reserve_free_book(UUID, INT) TO service_role;

REVOKE ALL ON FUNCTION public.release_free_book(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_free_book(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.release_free_book(UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.release_free_book(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.release_free_reservation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_free_reservation(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.release_free_reservation(UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.release_free_reservation(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.count_guest_free_books(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_guest_free_books(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.count_guest_free_books(UUID, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.count_guest_free_books(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_guest_stories(UUID, UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_guest_stories(UUID, UUID, INT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_guest_stories(UUID, UUID, INT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_guest_stories(UUID, UUID, INT) TO service_role;

REVOKE ALL ON FUNCTION public.claim_guest_stories_by_verified_email(UUID, TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_guest_stories_by_verified_email(UUID, TEXT, INT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_guest_stories_by_verified_email(UUID, TEXT, INT, INT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_guest_stories_by_verified_email(UUID, TEXT, INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.increment_books_generated(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_books_generated(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.increment_books_generated(UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_books_generated(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.admin_revenue_by_period(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revenue_by_period(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.admin_revenue_by_period(TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_revenue_by_period(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- Reload PostgREST's schema cache so the new column and functions are
-- visible to the admin client.
NOTIFY pgrst, 'reload schema';

-- Post-check (read-only). Immediately after applying, expect: the column
-- and CHECK present; four functions with prosecdef = true and EXECUTE held
-- by service_role only; reserve_purchase / release_purchase bodies contain
-- "consumed_request_id IS NULL"; row counts of story_requests,
-- story_purchases, subscription_periods, deletion_log and storage.objects
-- unchanged. The exact query is in the completion report.
