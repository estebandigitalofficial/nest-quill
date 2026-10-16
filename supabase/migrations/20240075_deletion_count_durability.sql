-- ============================================================
-- PRIVACY FOUNDATION 3C-1b — deletion evidence durability
--
-- Corrects the two functions introduced by 20240074 and nothing else.
-- No table, column, enum, index, policy or grant on any other object
-- changes. Applying it touches NO customer row: it only redefines
-- delete_failed_story(UUID, UUID) and complete_story_deletion(UUID, JSONB)
-- and reasserts their service-role-only ACLs. 20240074 stays in place as
-- historical source; this file supersedes its two function bodies.
--
-- ── The gap (found by the 3C-2 crash-boundary audit, 2026-10-16) ─
-- 20240074's delete_failed_story inserted the deletion_log record with the
-- default counts '{}', computed the eleven database deletion counts into
-- v_counts, deleted the story row (cascading every child row) and returned
-- v_counts ONLY to the caller. complete_story_deletion then REPLACED
-- deletion_log.counts with whatever the caller passed. If the caller died
-- after the delete committed and before completion, the resumed call
-- returned counts '{}' and the original database counts were gone for good
-- (the rows they described no longer exist, processing_logs included).
--
-- ── The correction (bounded) ─────────────────────────────────
--   1. delete_failed_story, fresh deletion: after the row delete and the
--      counts are built, in the SAME transaction,
--        UPDATE deletion_log SET counts = v_counts WHERE id = v_log_id AND status = 'started';
--      so deletion and its evidence commit or roll back together.
--   2. delete_failed_story, no-row branch: the stored counts are selected
--      into v_counts and the 'started' (resumed) outcome returns
--        'counts', COALESCE(v_counts, '{}'::jsonb)
--      instead of '{}'.
--   3. complete_story_deletion merges instead of replacing:
--        counts = counts || COALESCE(p_counts, '{}'::jsonb)
--      so adding storage_objects can never erase the database counts.
-- Everything else in both functions (ownership, not_found privacy,
-- eligibility and the 3-minute quiescence rule, Free release, purchase
-- detachment, known_paths, FK-less cleanup, cascade, outcome names,
-- started → completed only, BOOLEAN result, the deletion_log_counts_ok()
-- CHECK) is byte-identical to 20240074.
--
-- ── storage_objects semantics (accepted limitation) ──────────
-- storage_objects is still supplied by the caller at completion and means
-- the number of objects confirmed removed during the invocation that
-- completed the cleanup. If an earlier attempt removed some objects and
-- then died, those are not counted: the operational count can be lower
-- than the historical total removed across attempts. No per-object
-- tombstones or cumulative state are introduced; the durable evidence this
-- migration guarantees is the eleven database counts, which become
-- unrecoverable once the rows cascade away.
--
-- Idempotent (CREATE OR REPLACE + REVOKE/GRANT) and forward only. Apply by
-- hand in the Supabase SQL Editor after the read-only preflight in the
-- completion report; do not apply until the Founder authorizes it.
-- ============================================================

-- ── 1. delete_failed_story (20240074 body + changes 1 and 2 above) ──
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
    SELECT id, status, actor_type, actor_id, counts
      INTO v_log_id, v_log_status, v_log_actor_type, v_log_actor_id, v_counts
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
    -- 3C-1b: the database counts were persisted on this record in the
    -- deleting transaction (step I below), so they are returned here instead
    -- of '{}' and survive the crash/retry boundary.
    RETURN jsonb_build_object(
      'outcome', 'deleted', 'resumed', true, 'log_id', v_log_id,
      'known_paths', '[]'::jsonb, 'counts', COALESCE(v_counts, '{}'::jsonb), 'free_released', false
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

  -- I. 3C-1b: persist the database evidence on the record in THIS
  --    transaction, so the row delete and its counts commit (or roll back)
  --    together. Without this the counts existed only in the jsonb returned
  --    to the caller and were lost if it died before complete_story_deletion.
  --    Every key is in the deletion_log_counts_ok() allow-list.
  UPDATE public.deletion_log
     SET counts = v_counts
   WHERE id = v_log_id
     AND status = 'started';

  RETURN jsonb_build_object(
    'outcome', 'deleted', 'resumed', false, 'log_id', v_log_id,
    'known_paths', v_known_paths, 'counts', v_counts, 'free_released', v_free_released
  );
END;
$$;

COMMENT ON FUNCTION public.delete_failed_story(UUID, UUID) IS
  'Atomically deletes an archived failed story owned by p_user_id (eligibility, deletion_log started, Free release, purchase detach, FK-less cleanups, row delete), persists the database deletion counts on the deletion_log record in the same transaction and returns the storage paths to remove. Repeat calls are recognised through deletion_log.actor_id and return the stored counts. Service role only.';

-- ── 2. complete_story_deletion (20240074 body + change 3 above) ──
-- started → completed only. The caller's counts are MERGED into the counts
-- persisted by delete_failed_story; the table CHECK deletion_log_counts_ok()
-- still validates the result. Idempotent: false when the record is not in
-- 'started'.
CREATE OR REPLACE FUNCTION public.complete_story_deletion(p_log_id UUID, p_counts JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.deletion_log
     SET status = 'completed', completed_at = now(), counts = counts || COALESCE(p_counts, '{}'::jsonb)
   WHERE id = p_log_id AND status = 'started';
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.complete_story_deletion(UUID, JSONB) IS
  'Marks a started deletion_log record completed after storage cleanup, merging the caller''s bounded counts (e.g. storage_objects) into the database counts persisted by delete_failed_story. Service role only.';

-- ── 3. Grants: reassert service-role only for the two corrected functions ──
-- CREATE OR REPLACE keeps existing ACLs, but the posture is restated so the
-- file is self-sufficient. No other function's grants are touched.
REVOKE ALL ON FUNCTION public.delete_failed_story(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_failed_story(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.delete_failed_story(UUID, UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_failed_story(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.complete_story_deletion(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_story_deletion(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.complete_story_deletion(UUID, JSONB) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.complete_story_deletion(UUID, JSONB) TO service_role;

-- Reload PostgREST's schema cache so the redefined functions are visible to
-- the admin client.
NOTIFY pgrst, 'reload schema';

-- Post-check (read-only). Immediately after applying, expect: both function
-- bodies contain the 3C-1b statements (UPDATE deletion_log SET counts =
-- v_counts; COALESCE(v_counts; counts || COALESCE(p_counts), prosecdef =
-- true, proconfig search_path=public, EXECUTE held by service_role only;
-- row counts of story_requests, story_purchases, subscription_periods,
-- profiles, deletion_log and storage.objects unchanged. The exact query is
-- in the completion report.
