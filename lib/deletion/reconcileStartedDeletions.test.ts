// 3C-6 reconciliation sweep: selection, outcome handling and scheduler
// authentication over fakes, plus source contracts (service reuse, no storage
// code here, no customer route, no UI, no migration, server-only). Never
// touches a database, a bucket or the network.
// Run: node --experimental-strip-types --test lib/deletion/reconcileStartedDeletions.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  RECONCILE_BATCH_SIZE,
  RECONCILE_MIN_AGE_MS,
  RECONCILE_SELECT_COLUMNS,
  RECONCILE_TIME_BUDGET_MS,
  classifyRow,
  isAuthorizedSweepRequest,
  reconcileStartedDeletions,
  type ReconciliationClient,
  type SelectionQuery,
} from './reconcileStartedDeletions.ts'
import { deleteFailedStory, type DeleteFailedStoryInput, type DeleteFailedStoryResult, type StoryDeletionClient } from './deleteFailedStory.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const NOW = Date.parse('2026-10-16T12:00:00.000Z')
const MIN = 60_000
const uuid = (n: number, block = '4000-8000') => `${String(n).padStart(8, '0')}-0000-${block}-${String(n).padStart(12, '0')}`
const USER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

// ── Fake deletion_log + builder ───────────────────────────────
type Row = Record<string, unknown>
function startedRow(n: number, ageMs: number, over: Row = {}): Row {
  return {
    id: uuid(n), deletion_type: 'story', subject_id: uuid(1000 + n), actor_type: 'customer', actor_id: USER,
    status: 'started', started_at: new Date(NOW - ageMs).toISOString(), ...over,
  }
}

type Filter = { kind: 'eq'; column: string; value: string } | { kind: 'not_is_null'; column: string } | { kind: 'lte'; column: string; value: string }
interface FakeDb {
  client: ReconciliationClient
  calls: { select: string[]; filters: Filter[]; order: Array<{ column: string; ascending: boolean }>; limit: number | null; rpc: Array<{ fn: string; args: Record<string, unknown> | undefined }>; storage: number }
}
/** Applies the recorded filter chain to in-memory rows, so the selection logic is exercised for real. */
function fakeDb(rows: Row[], opts: { selectError?: string; selectThrows?: boolean; rpc?: StoryDeletionClient['rpc'] } = {}): FakeDb {
  const calls: FakeDb['calls'] = { select: [], filters: [], order: [], limit: null, rpc: [], storage: 0 }
  const run = async () => {
    if (opts.selectThrows) throw new Error('network down')
    if (opts.selectError) return { data: null, error: { message: opts.selectError } }
    let out = rows.filter((r) => calls.filters.every((f) => {
      if (f.kind === 'eq') return r[f.column] === f.value
      if (f.kind === 'not_is_null') return r[f.column] !== null && r[f.column] !== undefined
      return typeof r[f.column] === 'string' && (r[f.column] as string) <= f.value
    }))
    out = [...out].sort((a, b) => {
      for (const o of calls.order) {
        const x = String(a[o.column]), y = String(b[o.column])
        if (x !== y) return (x < y ? -1 : 1) * (o.ascending ? 1 : -1)
      }
      return 0
    })
    if (calls.limit !== null) out = out.slice(0, calls.limit)
    return { data: out.map((r) => ({ ...r })), error: null }
  }
  const builder: SelectionQuery = {
    eq(column, value) { calls.filters.push({ kind: 'eq', column, value }); return builder },
    not(column, operator, value) { assert.equal(operator, 'is'); assert.equal(value, null); calls.filters.push({ kind: 'not_is_null', column }); return builder },
    lte(column, value) { calls.filters.push({ kind: 'lte', column, value }); return builder },
    order(column, options) { calls.order.push({ column, ascending: options.ascending }); return builder },
    limit(count) { calls.limit = count; return run() },
  }
  const client: ReconciliationClient = {
    from(table) {
      assert.equal(table, 'deletion_log')
      return { select(columns) { calls.select.push(columns); return builder } }
    },
    async rpc(fn, args) {
      calls.rpc.push({ fn, args })
      if (opts.rpc) return opts.rpc(fn, args)
      throw new Error(`unexpected rpc ${fn}`)
    },
    storage: { from() { calls.storage++; throw new Error('the sweep must never touch storage directly') } },
  }
  return { client, calls }
}

/** A scripted stand-in for the 3C-2 service: records inputs, returns the next result. */
function scriptedService(results: Array<DeleteFailedStoryResult | Error>) {
  const inputs: DeleteFailedStoryInput[] = []
  const service = async (_client: StoryDeletionClient, input: DeleteFailedStoryInput): Promise<DeleteFailedStoryResult> => {
    inputs.push(input)
    const r = results.shift()
    if (!r) throw new Error('scripted service ran out of results')
    if (r instanceof Error) throw r
    return r
  }
  return { service, inputs }
}
const deleted = (completedNow: boolean): DeleteFailedStoryResult => ({ outcome: 'deleted', logId: uuid(1), resumed: true, completedNow, freeReleased: false, storageObjectsRemoved: 3, counts: { storage_objects: 3 }, rejectedKnownPaths: [] })
const incomplete = (code = 'storage_objects_remain'): DeleteFailedStoryResult => ({ outcome: 'incomplete', retryable: true, logId: uuid(1), resumed: true, stage: 'storage_verify', failureCode: code, detail: 'secret/path/should/never/be/logged.jpg', storageObjectsRemoved: 2, remainingObjects: 1 })
const rpcFailed = (code = 'delete_rpc_error'): DeleteFailedStoryResult => ({ outcome: 'rpc_failed', retryable: true, failureCode: code, detail: 'connection reset' })
const quiet = { now: () => NOW, warn: () => {} }

// ── Selection ────────────────────────────────────────────────
test('1. started records younger than 10 minutes are skipped by the query and by the guard', async () => {
  const db = fakeDb([startedRow(1, 9 * MIN + 59_000), startedRow(2, 1 * MIN), startedRow(3, 0)])
  const s = scriptedService([])
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: s.service })
  assert.equal(summary.scanned, 0)
  assert.equal(summary.attempted, 0)
  assert.deepEqual(s.inputs, [])
  // the guard agrees even when handed the row directly
  assert.deepEqual(classifyRow(startedRow(1, RECONCILE_MIN_AGE_MS - 1), NOW), { ok: false, reason: 'too_young' })
})

test('2. records exactly at and older than the threshold are eligible, and the threshold is exactly 10 minutes', async () => {
  assert.equal(RECONCILE_MIN_AGE_MS, 10 * 60 * 1000)
  const db = fakeDb([startedRow(1, RECONCILE_MIN_AGE_MS), startedRow(2, 3 * 60 * MIN)])
  const s = scriptedService([deleted(true), deleted(true)])
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: s.service })
  assert.equal(summary.scanned, 2)
  assert.equal(summary.eligible, 2)
  assert.equal(summary.attempted, 2)
  assert.equal(classifyRow(startedRow(1, RECONCILE_MIN_AGE_MS), NOW).ok, true)
  // the cutoff sent to the database is now - 10 minutes
  const lte = db.calls.filters.find((f) => f.kind === 'lte')
  assert.deepEqual(lte, { kind: 'lte', column: 'started_at', value: new Date(NOW - RECONCILE_MIN_AGE_MS).toISOString() })
})

test('3. completed and failed records are never selected or attempted', async () => {
  const rows = [
    startedRow(1, 60 * MIN, { status: 'completed', completed_at: new Date(NOW).toISOString() }),
    startedRow(2, 60 * MIN, { status: 'failed', completed_at: new Date(NOW).toISOString(), failure_code: 'x' }),
  ]
  const db = fakeDb(rows)
  const s = scriptedService([])
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: s.service })
  assert.equal(summary.scanned, 0)
  assert.ok(db.calls.filters.some((f) => f.kind === 'eq' && f.column === 'status' && f.value === 'started'))
  assert.deepEqual(classifyRow(rows[0], NOW), { ok: false, reason: 'wrong_status' })
})

test('4. non-story deletion types are skipped', async () => {
  const row = startedRow(1, 60 * MIN, { deletion_type: 'account' })
  const db = fakeDb([row])
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: scriptedService([]).service })
  assert.equal(summary.scanned, 0)
  assert.ok(db.calls.filters.some((f) => f.kind === 'eq' && f.column === 'deletion_type' && f.value === 'story'))
  assert.deepEqual(classifyRow(row, NOW), { ok: false, reason: 'wrong_deletion_type' })
})

test('5. admin and system actors are skipped: only customer deletions are reconciled', async () => {
  const rows = [startedRow(1, 60 * MIN, { actor_type: 'admin' }), startedRow(2, 60 * MIN, { actor_type: 'system', actor_id: null })]
  const db = fakeDb(rows)
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: scriptedService([]).service })
  assert.equal(summary.scanned, 0)
  assert.ok(db.calls.filters.some((f) => f.kind === 'eq' && f.column === 'actor_type' && f.value === 'customer'))
  assert.deepEqual(classifyRow(rows[0], NOW), { ok: false, reason: 'wrong_actor_type' })
  assert.deepEqual(classifyRow(rows[1], NOW), { ok: false, reason: 'wrong_actor_type' })
})

test('6. null actor_id or subject_id (guest rows, malformed rows) are skipped', async () => {
  const rows = [startedRow(1, 60 * MIN, { actor_id: null }), startedRow(2, 60 * MIN, { subject_id: null })]
  const db = fakeDb(rows)
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: scriptedService([]).service })
  assert.equal(summary.scanned, 0)
  assert.ok(db.calls.filters.some((f) => f.kind === 'not_is_null' && f.column === 'actor_id'))
  assert.ok(db.calls.filters.some((f) => f.kind === 'not_is_null' && f.column === 'subject_id'))
  assert.deepEqual(classifyRow(rows[0], NOW), { ok: false, reason: 'missing_actor_id' })
  assert.deepEqual(classifyRow(rows[1], NOW), { ok: false, reason: 'missing_subject_id' })
  assert.deepEqual(classifyRow(startedRow(3, 60 * MIN, { actor_id: 'not-a-uuid' }), NOW), { ok: false, reason: 'malformed_id' })
  assert.deepEqual(classifyRow(startedRow(4, 60 * MIN, { started_at: 'yesterday' }), NOW), { ok: false, reason: 'bad_started_at' })
  assert.deepEqual(classifyRow(null, NOW), { ok: false, reason: 'not_a_row' })
})

test('7. oldest started_at first, then id, deterministically', async () => {
  const rows = [startedRow(3, 30 * MIN), startedRow(1, 90 * MIN), startedRow(2, 60 * MIN), startedRow(4, 60 * MIN)]
  const db = fakeDb(rows)
  const s = scriptedService([deleted(true), deleted(true), deleted(true), deleted(true)])
  await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: s.service })
  assert.deepEqual(db.calls.order, [{ column: 'started_at', ascending: true }, { column: 'id', ascending: true }])
  assert.deepEqual(s.inputs.map((i) => i.requestId), [uuid(1001), uuid(1002), uuid(1004), uuid(1003)])
})

test('8. the batch is bounded: at most RECONCILE_BATCH_SIZE rows per invocation, and the size is conservative', async () => {
  assert.equal(RECONCILE_BATCH_SIZE, 10)
  assert.ok(RECONCILE_TIME_BUDGET_MS < 60_000, 'time budget sits inside the route maxDuration')
  const rows = Array.from({ length: 25 }, (_, i) => startedRow(i + 1, (60 + i) * MIN))
  const db = fakeDb(rows)
  const s = scriptedService(Array.from({ length: 25 }, () => deleted(true)))
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: s.service })
  assert.equal(db.calls.limit, RECONCILE_BATCH_SIZE)
  assert.equal(summary.scanned, 10)
  assert.equal(summary.attempted, 10)
  assert.equal(s.inputs.length, 10)
  // the exact column list is read, nothing else
  assert.deepEqual(db.calls.select, [RECONCILE_SELECT_COLUMNS])
})

// ── Service reuse and mapping ────────────────────────────────
test('9. the existing 3C-2 service is the default executor, exercised end to end over a fake Supabase client', async () => {
  // Real deleteFailedStory over fake rpc + storage: resumed deletion, two objects, completes.
  const story = uuid(1001)
  const objects: Record<string, Set<string>> = { 'story-images': new Set([`${story}/1.jpg`, `${story}/cover.jpg`]), 'book-exports': new Set() }
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = []
  const storageCalls: string[] = []
  const client: ReconciliationClient = {
    ...fakeDb([startedRow(1, 60 * MIN)]).client,
    async rpc(fn, args) {
      rpcCalls.push({ fn, args })
      if (fn === 'delete_failed_story') return { data: { outcome: 'deleted', resumed: true, log_id: uuid(1), known_paths: [], counts: { story_requests: 1, story_scenes: 8 }, free_released: false }, error: null }
      if (fn === 'complete_story_deletion') return { data: true, error: null }
      throw new Error(`unexpected rpc ${fn}`)
    },
    storage: {
      from(bucket) {
        return {
          async list(path) {
            storageCalls.push(`list ${bucket} ${path}`)
            const prefix = `${path}/`
            return { data: [...(objects[bucket] ?? [])].filter((p) => p.startsWith(prefix)).map((p, i) => ({ name: p.slice(prefix.length), id: `o${i}` })), error: null }
          },
          async remove(paths) {
            storageCalls.push(`remove ${bucket} ${paths.length}`)
            for (const p of paths) objects[bucket]?.delete(p)
            return { data: paths.map((name) => ({ name })), error: null }
          },
        }
      },
    },
  }
  const summary = await reconcileStartedDeletions(client, { ...quiet })
  assert.equal(summary.attempted, 1)
  assert.equal(summary.completed, 1)
  assert.deepEqual(rpcCalls[0], { fn: 'delete_failed_story', args: { p_request_id: story, p_user_id: USER } })
  assert.deepEqual(rpcCalls[1], { fn: 'complete_story_deletion', args: { p_log_id: uuid(1), p_counts: { story_requests: 1, story_scenes: 8, storage_objects: 2 } } })
  assert.deepEqual([...objects['story-images']], [])
  assert.ok(storageCalls.some((c) => c.startsWith('remove story-images 2')), 'the service, not the sweep, removed the objects')
  // and the default executor really is the 3C-2 export
  const src = readFileSync(resolve(ROOT, 'lib/deletion/reconcileStartedDeletions.ts'), 'utf8')
  assert.match(src, /opts\.deleteStory \?\? deleteFailedStory/)
  assert.match(src, /import \{ deleteFailedStory[^}]*\} from '\.\/deleteFailedStory\.ts'/)
  assert.equal(typeof deleteFailedStory, 'function')
})

test('10. requestId = deletion_log.subject_id and userId = deletion_log.actor_id, normalised to lowercase', async () => {
  const row = startedRow(1, 60 * MIN, { subject_id: uuid(1001).toUpperCase(), actor_id: USER.toUpperCase() })
  const db = fakeDb([row])
  const s = scriptedService([deleted(true)])
  await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: s.service })
  assert.deepEqual(s.inputs, [{ requestId: uuid(1001), userId: USER }])
})

// ── Outcome handling ─────────────────────────────────────────
test('11. a resumed deletion that completes now counts as completed', async () => {
  const db = fakeDb([startedRow(1, 60 * MIN)])
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: scriptedService([deleted(true)]).service })
  assert.equal(summary.completed, 1)
  assert.equal(summary.alreadyCompleted, 0)
  assert.equal(summary.incomplete, 0)
  assert.equal(summary.rpcFailed, 0)
  assert.deepEqual(summary.failureCodes, {})
})

test('12. an already-completed (idempotent) result is safe and counted separately', async () => {
  const db = fakeDb([startedRow(1, 60 * MIN)])
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: scriptedService([deleted(false)]).service })
  assert.equal(summary.completed, 0)
  assert.equal(summary.alreadyCompleted, 1)
  assert.equal(db.calls.storage, 0)
})

test('13. incomplete stays retryable: counted, failure code recorded, no deletion_log write, no terminal state', async () => {
  const db = fakeDb([startedRow(1, 60 * MIN)])
  const lines: string[] = []
  const summary = await reconcileStartedDeletions(db.client, { now: () => NOW, warn: (l) => lines.push(l), deleteStory: scriptedService([incomplete()]).service })
  assert.equal(summary.incomplete, 1)
  assert.deepEqual(summary.failureCodes, { storage_objects_remain: 1 })
  // the sweep never writes deletion_log itself: only select was used, no rpc
  assert.deepEqual(db.calls.rpc, [])
  assert.deepEqual(db.calls.select.length, 1)
  // and the log line carries id, stage and code only, never the service detail
  assert.equal(lines.length, 1)
  assert.match(lines[0], new RegExp(`record ${uuid(1)} incomplete stage=storage_verify code=storage_objects_remain`))
  assert.doesNotMatch(lines[0], /secret\/path|\.jpg/)
})

test('14. rpc_failed stays retryable and is counted with its code', async () => {
  const db = fakeDb([startedRow(1, 60 * MIN)])
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: scriptedService([rpcFailed()]).service })
  assert.equal(summary.rpcFailed, 1)
  assert.deepEqual(summary.failureCodes, { delete_rpc_error: 1 })
  assert.deepEqual(db.calls.rpc, [])
})

test('15. one bad record does not stop the rest of the batch: a throw, an rpc failure and an unexpected outcome are all isolated', async () => {
  const rows = [startedRow(1, 90 * MIN), startedRow(2, 80 * MIN), startedRow(3, 70 * MIN), startedRow(4, 60 * MIN), startedRow(5, 50 * MIN)]
  const db = fakeDb(rows)
  const s = scriptedService([new Error('boom'), rpcFailed(), { outcome: 'not_found' }, deleted(true), incomplete('storage_remove_failed')])
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, deleteStory: s.service })
  assert.equal(summary.attempted, 5)
  assert.equal(summary.rpcFailed, 2) // the throw and the rpc failure
  assert.equal(summary.unexpected, 1)
  assert.equal(summary.completed, 1)
  assert.equal(summary.incomplete, 1)
  assert.deepEqual(summary.failureCodes, { service_threw: 1, delete_rpc_error: 1, unexpected_not_found: 1, storage_remove_failed: 1 })
  assert.deepEqual(s.inputs.map((i) => i.requestId), [uuid(1001), uuid(1002), uuid(1003), uuid(1004), uuid(1005)])
})

test('16. overlapping invocations are safe without a lock on the started record: the loser sees already_deleted or complete_not_applied, and only one started→completed transition exists', async () => {
  // Two sweeps select the same two records. The first completes both; the second's service
  // calls come back as idempotent success and as the complete-not-applied race, respectively.
  const rows = [startedRow(1, 60 * MIN), startedRow(2, 60 * MIN)]
  const a = fakeDb(rows), b = fakeDb(rows)
  const sa = scriptedService([deleted(true), deleted(true)])
  const sb = scriptedService([deleted(false), incomplete('complete_not_applied')])
  const [ra, rb] = await Promise.all([
    reconcileStartedDeletions(a.client, { ...quiet, deleteStory: sa.service }),
    reconcileStartedDeletions(b.client, { ...quiet, deleteStory: sb.service }),
  ])
  assert.equal(ra.completed, 2)
  assert.equal(rb.alreadyCompleted, 1)
  assert.equal(rb.incomplete, 1)
  assert.deepEqual(rb.failureCodes, { complete_not_applied: 1 })
  assert.equal(sa.inputs.length, 2)
  assert.equal(sb.inputs.length, 2)
  // the sweep never inserts or updates deletion_log, so no second record can come from here
  assert.deepEqual(a.calls.rpc, [])
  assert.deepEqual(b.calls.rpc, [])
  // The model above matches the merged function bodies: the only FOR UPDATE is on story_requests;
  // the resumed-path deletion_log lookup is a plain SELECT; and completion is guarded by status = 'started'.
  const m75 = readFileSync(resolve(ROOT, 'supabase/migrations/20240075_deletion_count_durability.sql'), 'utf8')
  assert.equal((m75.match(/FOR UPDATE/g) ?? []).length, 1, 'exactly one FOR UPDATE in 20240075')
  assert.match(m75, /FROM public\.story_requests WHERE id = p_request_id FOR UPDATE;/)
  const lookup = m75.match(/SELECT id, status, actor_type, actor_id, counts[\s\S]*?;/)?.[0] ?? ''
  assert.ok(lookup.includes('FROM public.deletion_log'), 'resumed-path lookup found')
  assert.doesNotMatch(lookup, /FOR UPDATE/, 'the resumed deletion_log lookup is not locked')
  assert.match(m75, /SET status = 'completed'[\s\S]*?WHERE id = p_log_id AND status = 'started';/)
})

test('16b. the time budget stops new attempts and reports them as skipped; a selection error attempts nothing', async () => {
  let t = NOW
  const db = fakeDb([startedRow(1, 90 * MIN), startedRow(2, 80 * MIN), startedRow(3, 70 * MIN)])
  const s = scriptedService([deleted(true), deleted(true), deleted(true)])
  const summary = await reconcileStartedDeletions(db.client, {
    warn: () => {},
    now: () => t,
    deleteStory: async (c, i) => { t += 30_000; return s.service(c, i) },
  })
  assert.equal(summary.attempted, 2)
  assert.equal(summary.skipped, 1)
  assert.deepEqual(summary.skippedReasons, { time_budget: 1 })
  const err = await reconcileStartedDeletions(fakeDb([startedRow(1, 90 * MIN)], { selectError: 'permission denied' }).client, { ...quiet, deleteStory: scriptedService([]).service })
  assert.equal(err.selectionError, 'select deletion_log: permission denied')
  assert.equal(err.attempted, 0)
  const thrown = await reconcileStartedDeletions(fakeDb([startedRow(1, 90 * MIN)], { selectThrows: true }).client, { ...quiet, deleteStory: scriptedService([]).service })
  assert.match(thrown.selectionError ?? '', /^select deletion_log threw/)
})

test('16c. dry run selects only: zero service calls, zero rpc, zero storage, counts reported', async () => {
  const db = fakeDb([startedRow(1, 60 * MIN), startedRow(2, 5 * MIN)])
  const s = scriptedService([])
  const summary = await reconcileStartedDeletions(db.client, { ...quiet, dryRun: true, deleteStory: s.service })
  assert.equal(summary.dryRun, true)
  assert.equal(summary.scanned, 1)
  assert.equal(summary.eligible, 1)
  assert.equal(summary.attempted, 0)
  assert.deepEqual(s.inputs, [])
  assert.deepEqual(db.calls.rpc, [])
  assert.equal(db.calls.storage, 0)
})

// ── Source contracts ─────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(p)
  }
  return out
}
const SOURCE_DIRS = ['app', 'components', 'lib', 'hooks', 'middleware.ts', 'supabase/functions'].map((d) => resolve(ROOT, d)).filter((p) => { try { statSync(p); return true } catch { return false } })
const SOURCES = SOURCE_DIRS.flatMap((p) => (statSync(p).isDirectory() ? walk(p) : [p]))
const SWEEP = resolve(ROOT, 'lib/deletion/reconcileStartedDeletions.ts')
const ROUTE = resolve(ROOT, 'app/api/cron/deletion-sweep/route.ts')
/** Executable text only: block and line comments removed, so documentation may name what the code must not touch. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
const sweepSrc = stripComments(readFileSync(SWEEP, 'utf8'))
const routeSrc = stripComments(readFileSync(ROUTE, 'utf8'))

test('17. the sweep module contains no storage code: no client.storage, no bucket names, no list/remove, no SQL function names', () => {
  assert.doesNotMatch(sweepSrc, /\.storage\b|storage\.from|story-images|book-exports|\.remove\(|\.list\(|STORAGE_/)
  assert.doesNotMatch(sweepSrc, /delete_failed_story|complete_story_deletion/, 'the SQL functions are called by the service only')
  assert.doesNotMatch(sweepSrc, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/, 'the sweep never writes deletion_log or any table')
  assert.doesNotMatch(routeSrc, /storage|delete_failed_story|complete_story_deletion|\.from\(/)
})

test('18. no customer DELETE route exists; the sweep route is GET only', () => {
  const routes = SOURCES.filter((p) => /app\/api\/.*route\.tsx?$/.test(p) && /export (async )?function DELETE/.test(readFileSync(p, 'utf8')))
  assert.ok(!routes.some((p) => /\/story\//.test(p)), `a DELETE handler exists under /api/story: ${routes.join(', ')}`)
  assert.match(routeSrc, /export async function GET\(/)
  assert.doesNotMatch(routeSrc, /export (async )?function (POST|PUT|PATCH|DELETE)\b/, 'only Vercel Cron GET is served')
  // the route sits under /api/cron like the existing scheduler entry points, and vercel.json schedules it
  const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }> }
  const entry = vercel.crons.find((c) => c.path === '/api/cron/deletion-sweep')
  assert.ok(entry, 'vercel.json schedules /api/cron/deletion-sweep')
  assert.match(entry!.schedule, /^(\S+\s+){4}\S+$/, 'five-field cron expression')
  assert.equal(entry!.schedule.split(/\s+/)[0] !== '*' && entry!.schedule.split(/\s+/)[1] !== '*', true, 'daily schedule (Hobby-plan compatible: fixed minute and hour)')
})

test('19. no UI was introduced: nothing under components/ or app/(pages) references the sweep or lib/deletion', () => {
  const importers = SOURCES.filter((p) => !p.startsWith(resolve(ROOT, 'lib/deletion')) && /lib\/deletion\/|from '\.\.?\/deletion/.test(readFileSync(p, 'utf8')))
  assert.deepEqual(importers, [ROUTE], 'only the cron route imports lib/deletion')
  const uiFiles = SOURCES.filter((p) => /\.tsx$/.test(p) || p.startsWith(resolve(ROOT, 'components')))
  for (const f of uiFiles) assert.doesNotMatch(readFileSync(f, 'utf8'), /deletion-sweep|reconcileStartedDeletions|deletion_log/, `${f} references the sweep`)
})

test('20. no migration was introduced and the three deletion migrations are untouched', () => {
  const migrations = readdirSync(resolve(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
  assert.equal(migrations.at(-1), '20240075_deletion_count_durability.sql', 'no new migration in 3C-6')
  // deletion_log's lifecycle CHECK forbids a failure_code on a started row: that is why the sweep records nothing on the row
  const m73 = readFileSync(resolve(ROOT, 'supabase/migrations/20240073_deletion_schema_foundation.sql'), 'utf8')
  assert.match(m73, /\(status = 'started'\s+AND completed_at IS NULL\s+AND failure_code IS NULL\)/)
  assert.doesNotMatch(m73, /failure_detail/)
})

test('21. server-only / service-role boundary: no client directive, admin client only in the route, env only in the route, fail-closed auth', () => {
  assert.doesNotMatch(sweepSrc, /['"]use client['"]/)
  assert.doesNotMatch(sweepSrc, /process\.env\.|SUPABASE_SERVICE_ROLE_KEY|createClient\(|createAdminClient/, 'the module holds no credential and builds no client')
  assert.match(sweepSrc, /typeof window !== 'undefined'\) throw/)
  for (const m of sweepSrc.matchAll(/^import\s[\s\S]*?from\s+'([^']+)'/gm)) assert.ok(m[1].startsWith('./') || m[1] === 'node:crypto', `sweep imports ${m[1]}`)
  assert.match(routeSrc, /createAdminClient\(\)/)
  assert.match(routeSrc, /isAuthorizedSweepRequest\(req\.headers\.get\('authorization'\), process\.env\.CRON_SECRET\)/)
  assert.match(routeSrc, /export const runtime = 'nodejs'/)
  // the route is shared only through the maintenance bypass that every /api route has; no 'use client' file imports it
  const clientFiles = SOURCES.filter((p) => /['"]use client['"]/.test(readFileSync(p, 'utf8').slice(0, 400)))
  for (const f of clientFiles) assert.doesNotMatch(readFileSync(f, 'utf8'), /lib\/deletion|deletion-sweep/)
})

test('22. no production mutation in tests: the fakes refuse storage, the fake rpc is only ever scripted, and this file never builds a real client', () => {
  const self = readFileSync(resolve(ROOT, 'lib/deletion/reconcileStartedDeletions.test.ts'), 'utf8')
  // only relative imports from lib/deletion and node builtins; never the supabase SDK or the admin client
  for (const m of self.matchAll(/^import\s[\s\S]*?from\s+'([^']+)'/gm)) assert.ok(m[1].startsWith('./') || m[1].startsWith('node:'), `test imports ${m[1]}`)
  assert.doesNotMatch(self, new RegExp(['fe', 'tch\\('].join('')))
  assert.doesNotMatch(self, new RegExp(['https?:', '//'].join('')), 'no network address appears in the test')
})

// ── Scheduler authentication ─────────────────────────────────
test('23. authentication: exact bearer match only, fails closed without a configured secret, and the response shape carries no sensitive detail', () => {
  assert.equal(isAuthorizedSweepRequest('Bearer s3cret-value', 's3cret-value'), true)
  assert.equal(isAuthorizedSweepRequest('Bearer s3cret-value ', 's3cret-value'), false)
  assert.equal(isAuthorizedSweepRequest('bearer s3cret-value', 's3cret-value'), false)
  assert.equal(isAuthorizedSweepRequest('Bearer other', 's3cret-value'), false)
  assert.equal(isAuthorizedSweepRequest('s3cret-value', 's3cret-value'), false)
  assert.equal(isAuthorizedSweepRequest(null, 's3cret-value'), false)
  assert.equal(isAuthorizedSweepRequest(undefined, 's3cret-value'), false)
  // fail closed: no secret → nobody, not even an empty bearer
  assert.equal(isAuthorizedSweepRequest('Bearer ', ''), false)
  assert.equal(isAuthorizedSweepRequest('Bearer undefined', undefined), false)
  assert.equal(isAuthorizedSweepRequest(null, undefined), false)
  // unauthorised calls return before any client is built
  const unauthorizedIdx = routeSrc.indexOf("new NextResponse('Unauthorized', { status: 401 })")
  const clientIdx = routeSrc.indexOf('createAdminClient()')
  assert.ok(unauthorizedIdx > 0 && clientIdx > unauthorizedIdx, 'auth check precedes the admin client')
  // the response is the aggregate summary only; the summary type has no id, path or content fields
  assert.match(routeSrc, /NextResponse\.json\(\{ ok, \.\.\.summary \}/)
  const summaryBlock = sweepSrc.slice(sweepSrc.indexOf('export interface ReconciliationSummary'), sweepSrc.indexOf('export interface ReconcileOptions'))
  const fields = [...summaryBlock.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1])
  assert.deepEqual(fields.sort(), ['alreadyCompleted', 'attempted', 'completed', 'dryRun', 'durationMs', 'eligible', 'failureCodes', 'incomplete', 'rpcFailed', 'scanned', 'selectionError', 'skipped', 'skippedReasons', 'unexpected'])
  for (const f of fields) assert.doesNotMatch(f, /id$|path|email|name|detail|subject|actor|request|user/i, `summary field ${f} looks like a per-record detail`)
})
