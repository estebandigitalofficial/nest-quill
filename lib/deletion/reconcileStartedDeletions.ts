/**
 * FAILED-STORY DELETION RECONCILIATION SWEEP (Privacy Foundation 3C-6)
 *
 * SERVER ONLY. Finishes customer story deletions whose database transaction
 * committed (deletion_log row 'started', story rows gone) but whose storage
 * cleanup or final completion did not run to the end: the Node process died,
 * a bucket call failed, or complete_story_deletion was never reached. Founder
 * decision D6 requires this to be operational before the customer deletion
 * route (3C-3) is enabled, because once the row is gone the customer can
 * never retry from the UI.
 *
 * What it does, and only this:
 *   1. SELECT a bounded, oldest-first batch from deletion_log where
 *        deletion_type = 'story' AND status = 'started'
 *        AND actor_type = 'customer' AND actor_id IS NOT NULL
 *        AND subject_id IS NOT NULL
 *        AND started_at <= now() - RECONCILE_MIN_AGE_MS
 *      (RECONCILE_BATCH_SIZE rows, ORDER BY started_at ASC, id ASC).
 *   2. Re-check every row in process (same predicate; the query is trusted
 *      but not relied upon), then call the 3C-2 service
 *        deleteFailedStory(client, { requestId: subject_id, userId: actor_id })
 *      which re-enters delete_failed_story (resumed=true: the row is gone,
 *      the stored counts come back), rediscovers both storage prefixes,
 *      removes, re-lists, and completes the record. Nothing about storage
 *      (buckets, paths, listing, removal, batching, the verified-empty rule)
 *      lives here; the service is authoritative and this module never
 *      touches client.storage.
 *   3. Count outcomes into an aggregate summary and return it.
 *
 * Age gate: a started record is left alone for RECONCILE_MIN_AGE_MS
 * (10 minutes). The worker lease (3C-7) guarantees a stale process-story
 * worker can no longer WRITE rows, but a storage upload it had in flight can
 * land after the row delete; the Free-plan edge limit is 150 s and the
 * worker's own idle rule is 3 minutes, so 10 minutes is the second prefix
 * pass the deletion design requires. Never lower it.
 *
 * Failure semantics: nothing here is ever marked 'failed'. deletion_log's
 * lifecycle CHECK (20240073) requires failure_code IS NULL while status =
 * 'started' and completed_at + failure_code when 'failed', so the only way
 * to record a failure on the row is to make it terminal, which would end
 * retries for a condition (a bucket outage, a late upload) that resolves on
 * its own. incomplete and rpc_failed therefore leave the record exactly as
 * it was and it is picked up again by the next sweep. The latest failure
 * code is reported in the summary (aggregate) and in the server log, not on
 * the row. A record that keeps failing shows up in every summary.
 *
 * Concurrency: two sweeps, or a sweep and a customer retry, may hit the same
 * record, and nothing locks them apart up front. delete_failed_story takes
 * FOR UPDATE on the story_requests row only; on the resumed path that row is
 * already gone, and the deletion_log lookup is a plain SELECT, so both
 * callers receive resumed = true with the same stored counts and both run
 * the service's bounded, prefix-constrained discovery, removal and re-list
 * (removing an already-removed object is a no-op). The single point of
 * serialisation is complete_story_deletion's
 *   UPDATE deletion_log SET status = 'completed' ... WHERE id = $1 AND status = 'started'
 * which is one row-level write: the second UPDATE waits for the first to
 * commit, re-evaluates its WHERE, matches nothing and returns false, so the
 * loser reports `incomplete` (complete_not_applied) and the next pass sees
 * already_deleted. No new deletion_log record can appear from this path
 * (the INSERT lives on the live-story path, under the story row lock, and
 * the partial unique index allows one started/completed record per story)
 * and this module never writes deletion_log itself. Duplicate storage work
 * is the only cost; both outcomes are counted, neither is harmful.
 *
 * Observability: the summary holds counts, a histogram of failure codes and
 * the elapsed time. It never holds story content, child data, emails,
 * prompts or storage paths. Per-record log lines carry the opaque
 * deletion_log id, outcome, stage and failure code only, never the service's
 * free-text detail (which can quote a bucket error message).
 */
import { timingSafeEqual } from 'node:crypto'
import { deleteFailedStory, type DeleteFailedStoryInput, type DeleteFailedStoryResult, type StoryDeletionClient } from './deleteFailedStory.ts'
import { normalizeRequestId } from './storagePaths.ts'

// ── Tunables (the single authoritative definitions) ─────────────
/** A started deletion is reconciled only once it is at least this old. Design floor: 10 minutes. Never lower it. */
export const RECONCILE_MIN_AGE_MS = 10 * 60_000
/** Records per invocation. Each one costs roughly eight Supabase round trips (one RPC, two listings per bucket, removals, one RPC); ten fits well inside the route's 60 s maxDuration. */
export const RECONCILE_BATCH_SIZE = 10
/** Stop starting new records once this much wall time has passed, so a slow bucket can never push the invocation into the platform kill. Unstarted rows are simply left for the next sweep. */
export const RECONCILE_TIME_BUDGET_MS = 45_000

// ── Client surface ──────────────────────────────────────────────
export interface SelectionResponse { data: unknown[] | null; error: { message: string } | null }
/** The PostgREST filter chain this module uses, as a structural subset of supabase-js' builder. */
export interface SelectionQuery {
  eq(column: string, value: string): SelectionQuery
  not(column: string, operator: 'is', value: null): SelectionQuery
  lte(column: string, value: string): SelectionQuery
  order(column: string, options: { ascending: boolean }): SelectionQuery
  limit(count: number): PromiseLike<SelectionResponse>
}
/** Structural subset of the service-role SupabaseClient returned by createAdminClient(). */
export interface ReconciliationClient extends StoryDeletionClient {
  from(table: string): { select(columns: string): SelectionQuery }
}

/** The deletion_log columns the sweep reads. */
export const RECONCILE_SELECT_COLUMNS = 'id, deletion_type, subject_id, actor_type, actor_id, status, started_at'
export interface StartedDeletionRow {
  id: string
  deletion_type: string
  subject_id: string | null
  actor_type: string
  actor_id: string | null
  status: string
  started_at: string
}

// ── Row guard (pure) ────────────────────────────────────────────
export type SkipReason =
  | 'not_a_row'
  | 'wrong_deletion_type'
  | 'wrong_status'
  | 'wrong_actor_type'
  | 'missing_actor_id'
  | 'missing_subject_id'
  | 'malformed_id'
  | 'bad_started_at'
  | 'too_young'

/**
 * Re-applies the selection predicate in process. The database query already
 * filters this way; the guard makes the sweep safe even if the query, the
 * client or a future column change let a row through, and it is where the
 * tests pin the predicate.
 */
export function classifyRow(raw: unknown, nowMs: number): { ok: true; row: StartedDeletionRow; requestId: string; userId: string } | { ok: false; reason: SkipReason } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not_a_row' }
  const r = raw as Record<string, unknown>
  if (r.deletion_type !== 'story') return { ok: false, reason: 'wrong_deletion_type' }
  if (r.status !== 'started') return { ok: false, reason: 'wrong_status' }
  if (r.actor_type !== 'customer') return { ok: false, reason: 'wrong_actor_type' }
  if (typeof r.actor_id !== 'string' || r.actor_id.length === 0) return { ok: false, reason: 'missing_actor_id' }
  if (typeof r.subject_id !== 'string' || r.subject_id.length === 0) return { ok: false, reason: 'missing_subject_id' }
  const requestId = normalizeRequestId(r.subject_id)
  const userId = normalizeRequestId(r.actor_id)
  const logId = typeof r.id === 'string' ? normalizeRequestId(r.id) : null
  if (!requestId || !userId || !logId) return { ok: false, reason: 'malformed_id' }
  const startedAt = typeof r.started_at === 'string' ? Date.parse(r.started_at) : NaN
  if (!Number.isFinite(startedAt)) return { ok: false, reason: 'bad_started_at' }
  if (nowMs - startedAt < RECONCILE_MIN_AGE_MS) return { ok: false, reason: 'too_young' }
  return {
    ok: true,
    row: { id: logId, deletion_type: 'story', subject_id: requestId, actor_type: 'customer', actor_id: userId, status: 'started', started_at: r.started_at as string },
    requestId,
    userId,
  }
}

// ── Summary ─────────────────────────────────────────────────────
export interface ReconciliationSummary {
  dryRun: boolean
  /** Rows the query returned. */
  scanned: number
  /** Rows that passed the in-process guard. */
  eligible: number
  /** Service calls made (0 in dry-run). */
  attempted: number
  /** deleted with completedNow = true: this sweep finished the record. */
  completed: number
  /** deleted with completedNow = false: another invocation had already completed it. */
  alreadyCompleted: number
  /** Storage cleanup or completion did not finish; record stays 'started' and retryable. */
  incomplete: number
  /** delete_failed_story failed or the service threw; nothing changed, retryable. */
  rpcFailed: number
  /** not_found / not_eligible for a started customer record: should not happen; record stays as is. */
  unexpected: number
  /** Rows not attempted: failed the guard or fell outside the time budget. */
  skipped: number
  skippedReasons: Partial<Record<SkipReason | 'time_budget', number>>
  /** Histogram of service failure codes seen in this invocation. */
  failureCodes: Record<string, number>
  /** Set when the selection query itself failed; no row was attempted. */
  selectionError: string | null
  durationMs: number
}

export interface ReconcileOptions {
  /** Selection only: zero service calls, zero storage calls, zero deletion_log writes. */
  dryRun?: boolean
  /** Clock, injectable for tests. */
  now?: () => number
  /** The deletion service; defaults to the real 3C-2 service. Injectable for tests only. */
  deleteStory?: (client: StoryDeletionClient, input: DeleteFailedStoryInput) => Promise<DeleteFailedStoryResult>
  /** Per-record log sink; defaults to console.warn. Receives bounded strings only. */
  warn?: (line: string) => void
  batchSize?: number
  timeBudgetMs?: number
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1
}

// ── Sweep ───────────────────────────────────────────────────────
export async function reconcileStartedDeletions(client: ReconciliationClient, opts: ReconcileOptions = {}): Promise<ReconciliationSummary> {
  if (typeof window !== 'undefined') throw new Error('lib/deletion is server-only')
  const now = opts.now ?? Date.now
  const deleteStory = opts.deleteStory ?? deleteFailedStory
  const warn = opts.warn ?? ((line: string) => console.warn(line))
  const batchSize = opts.batchSize ?? RECONCILE_BATCH_SIZE
  const timeBudgetMs = opts.timeBudgetMs ?? RECONCILE_TIME_BUDGET_MS
  const startedMs = now()
  const summary: ReconciliationSummary = {
    dryRun: opts.dryRun === true,
    scanned: 0, eligible: 0, attempted: 0, completed: 0, alreadyCompleted: 0, incomplete: 0, rpcFailed: 0, unexpected: 0, skipped: 0,
    skippedReasons: {}, failureCodes: {}, selectionError: null, durationMs: 0,
  }
  const finish = () => { summary.durationMs = Math.max(0, now() - startedMs); return summary }

  // 1. Bounded, deterministic selection. The cutoff is computed once so every row is judged against the same instant.
  const cutoffIso = new Date(startedMs - RECONCILE_MIN_AGE_MS).toISOString()
  let rows: unknown[]
  try {
    const res = await client
      .from('deletion_log')
      .select(RECONCILE_SELECT_COLUMNS)
      .eq('deletion_type', 'story')
      .eq('status', 'started')
      .eq('actor_type', 'customer')
      .not('actor_id', 'is', null)
      .not('subject_id', 'is', null)
      .lte('started_at', cutoffIso)
      .order('started_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(batchSize)
    if (res.error) { summary.selectionError = `select deletion_log: ${res.error.message}`; return finish() }
    rows = Array.isArray(res.data) ? res.data : []
  } catch (e) {
    summary.selectionError = `select deletion_log threw: ${e instanceof Error ? e.message : String(e)}`
    return finish()
  }
  summary.scanned = rows.length

  // 2. Guard, then hand each record to the service. One record's failure never stops the next.
  for (const raw of rows) {
    const c = classifyRow(raw, startedMs)
    if (!c.ok) { summary.skipped++; bump(summary.skippedReasons, c.reason); continue }
    summary.eligible++
    if (summary.dryRun) continue
    if (now() - startedMs > timeBudgetMs) { summary.skipped++; bump(summary.skippedReasons, 'time_budget'); continue }

    summary.attempted++
    let result: DeleteFailedStoryResult
    try {
      result = await deleteStory(client, { requestId: c.requestId, userId: c.userId })
    } catch (e) {
      summary.rpcFailed++
      bump(summary.failureCodes, 'service_threw')
      warn(`[deletion-sweep] record ${c.row.id} service_threw ${e instanceof Error ? e.constructor.name : 'error'}`)
      continue
    }
    switch (result.outcome) {
      case 'deleted':
        if (result.completedNow) summary.completed++
        else summary.alreadyCompleted++
        break
      case 'incomplete':
        summary.incomplete++
        bump(summary.failureCodes, result.failureCode)
        warn(`[deletion-sweep] record ${c.row.id} incomplete stage=${result.stage} code=${result.failureCode}`)
        break
      case 'rpc_failed':
        summary.rpcFailed++
        bump(summary.failureCodes, result.failureCode)
        warn(`[deletion-sweep] record ${c.row.id} rpc_failed code=${result.failureCode}`)
        break
      case 'not_found':
      case 'not_eligible':
        // A started customer record whose subject/actor pair the database no longer recognises.
        // Nothing to clean up from here; leave it for operators, keep it visible in every summary.
        summary.unexpected++
        bump(summary.failureCodes, `unexpected_${result.outcome}`)
        warn(`[deletion-sweep] record ${c.row.id} unexpected outcome=${result.outcome}`)
        break
    }
  }
  return finish()
}

// ── Scheduler authentication (pure) ─────────────────────────────
/**
 * Vercel Cron calls the route with `Authorization: Bearer <CRON_SECRET>`.
 * Fails closed: no configured secret means no caller is authorised, in
 * every environment. Constant-time comparison.
 */
export function isAuthorizedSweepRequest(authorizationHeader: string | null | undefined, cronSecret: string | undefined): boolean {
  if (typeof cronSecret !== 'string' || cronSecret.length === 0) return false
  if (typeof authorizationHeader !== 'string') return false
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const actual = Buffer.from(authorizationHeader)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
