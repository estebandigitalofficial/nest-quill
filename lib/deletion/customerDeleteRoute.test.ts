// 3C-3 customer DELETE route: contract tests for lib/deletion/customerDeleteRoute.ts
// driven through the REAL 3C-2 service against an in-memory world that models
// the 20240074/20240075 database semantics (row lock → eligibility check →
// delete, deletion_log started/completed, status-guarded completion) and the
// two storage buckets. Plus source pins on the route files and the untouched
// 3C-6 / migration / process-story / 3C-8 legal files.
// Run: node --experimental-strip-types --test lib/deletion/customerDeleteRoute.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  CUSTOMER_DELETION_FLAG_KEY,
  classifyServiceResult,
  handleCustomerStoryDelete,
  responseFor,
  type CustomerDeleteDeps,
  type CustomerDeleteLogEntry,
  type CustomerDeleteOutcome,
} from './customerDeleteRoute.ts'
import { deleteFailedStory, type DeleteFailedStoryResult, type StoryDeletionClient } from './deleteFailedStory.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const OWNER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const OTHER_USER = '11111111-2222-4333-8444-555555555555'
const STORY = 'aaaaaaaa-0000-4000-8000-000000000004'
const UNKNOWN = 'aaaaaaaa-0000-4000-8000-000000000099'
const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`

// ── In-memory world with the database semantics the SQL functions enforce ──
interface StoryRow { id: string; user_id: string | null; status: string; archived_at: string | null; worker_id: string | null }
interface LogRow { id: string; subject_id: string; actor_id: string; status: 'started' | 'completed'; counts: Record<string, unknown> | null }
interface World {
  stories: Map<string, StoryRow>
  logs: LogRow[]
  objects: Record<string, Set<string>>
  calls: { rpc: string[]; list: number; remove: number }
  /** objects remove() silently leaves behind (models a late upload / partial storage failure) */
  sticky: Set<string>
  client: StoryDeletionClient
  /** The hardened restore route, modelled: UPDATE ... WHERE id AND user_id AND (row exists) RETURNING id → 404 on zero rows. */
  restore(requestId: string, userId: string): { status: number }
}
function world(opts: { story?: Partial<StoryRow> | null; objects?: string[]; sticky?: string[]; rpcError?: string; rpcThrows?: boolean } = {}): World {
  const stories = new Map<string, StoryRow>()
  if (opts.story !== null) {
    stories.set(STORY, { id: STORY, user_id: OWNER, status: 'failed', archived_at: '2026-10-15T00:00:00.000Z', worker_id: null, ...(opts.story ?? {}) })
  }
  const objects: Record<string, Set<string>> = {
    'story-images': new Set(opts.objects ?? [`${STORY}/1.jpg`, `${STORY}/2.jpg`, `${STORY}/cover.jpg`]),
    'book-exports': new Set([`${STORY}/storybook.pdf`]),
  }
  const w: World = {
    stories, logs: [], objects, calls: { rpc: [], list: 0, remove: 0 }, sticky: new Set(opts.sticky ?? []),
    client: {
      async rpc(fn, args) {
        w.calls.rpc.push(fn)
        if (opts.rpcThrows) throw new Error('fetch failed: ECONNRESET to db.pejzpbyqaiajntndgavz.supabase.co')
        if (opts.rpcError) return { data: null, error: { message: opts.rpcError } }
        const a = args as Record<string, string | Record<string, unknown>>
        if (fn === 'delete_failed_story') {
          const requestId = a.p_request_id as string, userId = a.p_user_id as string
          const row = stories.get(requestId)
          if (!row || row.user_id !== userId) {
            // No live row for this caller: recognise this caller's own earlier deletion, else not_found.
            const log = w.logs.find((l) => l.subject_id === requestId && l.actor_id === userId)
            if (!log) return { data: { outcome: 'not_found' }, error: null }
            if (log.status === 'completed') return { data: { outcome: 'already_deleted', log_id: log.id }, error: null }
            return { data: { outcome: 'deleted', resumed: true, log_id: log.id, known_paths: [], counts: log.counts, free_released: false }, error: null }
          }
          // Locked eligibility check (archived, failed, no worker); the route never repeats it.
          if (row.archived_at === null || row.status !== 'failed' || row.worker_id !== null) return { data: { outcome: 'not_eligible' }, error: null }
          stories.delete(requestId)
          const log: LogRow = { id: uuid(500 + w.logs.length), subject_id: requestId, actor_id: userId, status: 'started', counts: { story_requests: 1 } }
          w.logs.push(log)
          return { data: { outcome: 'deleted', resumed: false, log_id: log.id, known_paths: [], counts: log.counts, free_released: true }, error: null }
        }
        if (fn === 'complete_story_deletion') {
          const log = w.logs.find((l) => l.id === a.p_log_id)
          if (!log || log.status !== 'started') return { data: false, error: null } // UPDATE ... WHERE status = 'started' matched nothing
          log.status = 'completed'
          return { data: true, error: null }
        }
        throw new Error(`unexpected rpc ${fn}`)
      },
      storage: {
        from(bucket) {
          return {
            async list(path, options) {
              w.calls.list++
              const offset = options?.offset ?? 0, limit = options?.limit ?? 100
              const prefix = path ? `${path}/` : ''
              const names = [...(objects[bucket] ?? [])].filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length)).filter((r) => !r.includes('/')).sort()
              return { data: names.slice(offset, offset + limit).map((name) => ({ name, id: uuid(1) })), error: null }
            },
            async remove(paths) {
              w.calls.remove++
              for (const p of paths) if (!w.sticky.has(p)) objects[bucket]?.delete(p)
              return { data: paths.map((name) => ({ name })), error: null }
            },
          }
        },
      },
    },
    restore(requestId, userId) {
      const row = stories.get(requestId)
      if (!row || row.user_id !== userId) return { status: 404 } // ownership read
      const matched = stories.get(requestId) // the UPDATE's own WHERE id AND user_id
      if (!matched || matched.user_id !== userId) return { status: 404 } // zero rows RETURNING → NotFoundError
      matched.archived_at = null
      return { status: 200 }
    },
  }
  return w
}

// ── Handler harness ───────────────────────────────────────────
interface Harness { deps: CustomerDeleteDeps; logs: CustomerDeleteLogEntry[]; serviceCalls: Array<{ requestId: string; userId: string }> }
function harness(w: World | null, opts: { enabled?: boolean | (() => Promise<boolean>); userId?: string | null | (() => Promise<string | null>); service?: (i: { requestId: string; userId: string }) => Promise<DeleteFailedStoryResult> } = {}): Harness {
  const logs: CustomerDeleteLogEntry[] = []
  const serviceCalls: Harness['serviceCalls'] = []
  const deps: CustomerDeleteDeps = {
    isEnabled: typeof opts.enabled === 'function' ? opts.enabled : async () => opts.enabled ?? true,
    getUserId: typeof opts.userId === 'function' ? opts.userId : async () => (opts.userId === undefined ? OWNER : opts.userId),
    deleteStory: async (input) => {
      serviceCalls.push(input)
      if (opts.service) return opts.service(input)
      if (!w) throw new Error('no world')
      return deleteFailedStory(w.client, input)
    },
    log: (e) => logs.push(e),
  }
  return { deps, logs, serviceCalls }
}
const NOT_FOUND = { message: 'Story not found', code: 'NOT_FOUND' }
const INTERNAL_WORDS = /pejzpbyqaiajntndgavz|supabase|storage|book-exports|story-images|\.jpg|\.pdf|log_id|logId|deletion_log|service_role|SQL|rpc|ECONNRESET|complete_not_applied|storage_objects_remain|detail|stage/i

// ── 1–5: gate, auth, id validation, not_found, not_eligible ───
test('1. unauthenticated request → 401 { message: Unauthorized } and the service is never called', async () => {
  const h = harness(world(), { userId: null })
  const res = await handleCustomerStoryDelete(h.deps, STORY)
  assert.equal(res.status, 401)
  assert.deepEqual(res.body, { message: 'Unauthorized' })
  assert.equal(h.serviceCalls.length, 0)
  assert.deepEqual(h.logs.map((l) => l.outcome), ['unauthenticated'])
})

test('2. malformed requestId → the same 404 body as an unknown story, service not called', async () => {
  for (const bad of ['not-a-uuid', '', ' ', '123', `${STORY}'; DROP TABLE story_requests;--`, `${STORY}/../other`, 'aaaaaaaa-0000-4000-8000-00000000000g', undefined, null, 42, { id: STORY }]) {
    const h = harness(world())
    const res = await handleCustomerStoryDelete(h.deps, bad)
    assert.equal(res.status, 404, `malformed ${JSON.stringify(bad)}`)
    assert.deepEqual(res.body, NOT_FOUND)
    assert.equal(h.serviceCalls.length, 0, `service called for ${JSON.stringify(bad)}`)
    assert.equal(h.logs[0]?.requestId, null, 'a malformed id is not logged')
  }
  // An upper-case UUID is syntactically valid and is normalised, not rejected.
  const h = harness(world())
  await handleCustomerStoryDelete(h.deps, STORY.toUpperCase())
  assert.deepEqual(h.serviceCalls, [{ requestId: STORY, userId: OWNER }])
})

test('3. unknown story → 404 with the identical body, via the authoritative service', async () => {
  const w = world()
  const h = harness(w)
  const res = await handleCustomerStoryDelete(h.deps, UNKNOWN)
  assert.equal(res.status, 404)
  assert.deepEqual(res.body, NOT_FOUND)
  assert.deepEqual(w.calls.rpc, ['delete_failed_story'])
  assert.equal(w.calls.list, 0, 'no storage touched for not_found')
  assert.equal(w.stories.size, 1)
})

test("4. another customer's archived failed story → 404 (not 403) and nothing is deleted", async () => {
  const w = world()
  const h = harness(w, { userId: OTHER_USER })
  const res = await handleCustomerStoryDelete(h.deps, STORY)
  assert.equal(res.status, 404)
  assert.deepEqual(res.body, NOT_FOUND)
  assert.ok(w.stories.has(STORY), 'the owner still has the story')
  assert.equal(w.objects['story-images'].size, 3)
  assert.equal(w.logs.length, 0)
})

test('5. not eligible (live, in flight or not archived) → 409 with a neutral message and nothing deleted', async () => {
  for (const story of [{ archived_at: null }, { status: 'complete' }, { status: 'queued' }, { worker_id: 'worker-1' }]) {
    const w = world({ story })
    const h = harness(w)
    const res = await handleCustomerStoryDelete(h.deps, STORY)
    assert.equal(res.status, 409, JSON.stringify(story))
    assert.deepEqual(res.body, { message: 'This story is not currently eligible for permanent deletion.', code: 'NOT_ELIGIBLE' })
    assert.doesNotMatch(JSON.stringify(res.body), /worker|owner|archiv|lock|quiescen/i)
    assert.ok(w.stories.has(STORY))
    assert.equal(w.logs.length, 0)
  }
})

// ── 6–10: success classes and failures ────────────────────────
test('6. fresh deletion → 200 { ok, state: deleted }; row, both prefixes and the log are reconciled by the service', async () => {
  const w = world()
  const h = harness(w)
  const res = await handleCustomerStoryDelete(h.deps, STORY)
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { ok: true, state: 'deleted' })
  assert.equal(w.stories.size, 0)
  assert.equal(w.objects['story-images'].size, 0)
  assert.equal(w.objects['book-exports'].size, 0)
  assert.deepEqual(w.logs.map((l) => l.status), ['completed'])
  assert.deepEqual(h.logs, [{ outcome: 'deleted', status: 200, requestId: STORY }])
})

test('7. repeated DELETE after a completed deletion → the same 200 body (already_deleted is a success, not an error)', async () => {
  const w = world()
  const h = harness(w)
  const first = await handleCustomerStoryDelete(h.deps, STORY)
  const second = await handleCustomerStoryDelete(h.deps, STORY)
  const third = await handleCustomerStoryDelete(h.deps, STORY)
  assert.deepEqual([first.status, second.status, third.status], [200, 200, 200])
  assert.deepEqual(second.body, first.body)
  assert.deepEqual(third.body, first.body)
  assert.deepEqual(h.logs.map((l) => l.outcome), ['deleted', 'already_deleted', 'already_deleted'])
  assert.equal(w.calls.rpc.filter((f) => f === 'complete_story_deletion').length, 1, 'completion happens once; repeats touch no storage')
})

test('8. incomplete cleanup → 202 cleanup_pending; the rows are gone, the log stays started for the 3C-6 sweep, and no "deleted" claim is made', async () => {
  const w = world({ sticky: [`${STORY}/2.jpg`] })
  const h = harness(w)
  const res = await handleCustomerStoryDelete(h.deps, STORY)
  assert.equal(res.status, 202)
  assert.deepEqual(res.body, { ok: true, state: 'cleanup_pending', message: 'Deletion has begun. Remaining cleanup finishes automatically.' })
  assert.equal(w.stories.size, 0)
  assert.deepEqual(w.logs.map((l) => l.status), ['started'])
  assert.deepEqual(h.logs, [{ outcome: 'cleanup_pending', status: 202, requestId: STORY, failureCode: 'storage_objects_remain' }])
})

test('9. rpc_failed (error result or thrown network error inside the service) → 500 generic; nothing changed', async () => {
  for (const opts of [{ rpcError: 'permission denied for function delete_failed_story' }, { rpcThrows: true }]) {
    const w = world(opts)
    const h = harness(w)
    const res = await handleCustomerStoryDelete(h.deps, STORY)
    assert.equal(res.status, 500)
    assert.deepEqual(res.body, { message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' })
    assert.ok(w.stories.has(STORY))
    assert.equal(h.logs[0].outcome, 'rpc_failed')
    assert.match(h.logs[0].failureCode ?? '', /^delete_rpc_(error|threw)$/)
  }
})

test('10. a thrown exception from the service or the auth dependency → 500 with no detail; a throwing gate → 404', async () => {
  const thrown = harness(null, { service: async () => { throw new Error('TypeError: fetch failed https://pejzpbyqaiajntndgavz.supabase.co/rest/v1/rpc/delete_failed_story') } })
  const res = await handleCustomerStoryDelete(thrown.deps, STORY)
  assert.equal(res.status, 500)
  assert.deepEqual(res.body, { message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' })
  assert.deepEqual(thrown.logs, [{ outcome: 'error', status: 500, requestId: STORY }])

  const authThrows = harness(world(), { userId: async () => { throw new Error('cookies() called outside a request scope') } })
  const res2 = await handleCustomerStoryDelete(authThrows.deps, STORY)
  assert.equal(res2.status, 500)
  assert.equal(authThrows.serviceCalls.length, 0)

  const gateThrows = harness(world(), { enabled: async () => { throw new Error('app_settings unreachable') } })
  const res3 = await handleCustomerStoryDelete(gateThrows.deps, STORY)
  assert.equal(res3.status, 404, 'a failing gate fails closed')
  assert.equal(gateThrows.serviceCalls.length, 0)
})

test('11. no internal detail reaches the response or the log in any failure class', async () => {
  const detail = `${STORY}/2.jpg still present; log_id ${uuid(7)}; permission denied for table deletion_log; https://pejzpbyqaiajntndgavz.supabase.co`
  const results: DeleteFailedStoryResult[] = [
    { outcome: 'incomplete', retryable: true, logId: uuid(7), resumed: false, stage: 'storage_verify', failureCode: 'storage_objects_remain', detail, storageObjectsRemoved: 2, remainingObjects: 1 },
    { outcome: 'rpc_failed', retryable: true, failureCode: 'delete_rpc_error', detail },
    { outcome: 'deleted', logId: uuid(7), resumed: true, completedNow: true, freeReleased: true, storageObjectsRemoved: 4, counts: { story_requests: 1, storage_objects: 4 }, rejectedKnownPaths: [{ bucket: 'story-images', path: '../x', reason: 'traversal' as never }] },
  ]
  for (const r of results) {
    const h = harness(null, { service: async () => r })
    const res = await handleCustomerStoryDelete(h.deps, STORY)
    const text = JSON.stringify(res.body)
    assert.doesNotMatch(text, INTERNAL_WORDS, `${r.outcome}: ${text}`)
    assert.doesNotMatch(text, new RegExp(uuid(7)), 'no deletion_log id')
    assert.doesNotMatch(text, /counts|storageObjects|freeReleased|resumed|rejected/i, 'no service internals')
    const logText = JSON.stringify(h.logs)
    assert.doesNotMatch(logText, /\.jpg|permission denied|supabase\.co|deletion_log/, `log leaks detail for ${r.outcome}: ${logText}`)
    assert.deepEqual(Object.keys(h.logs[0]).sort(), ['failureCode', 'outcome', 'requestId', 'status'].filter((k) => k !== 'failureCode' || r.outcome !== 'deleted').sort())
  }
})

// ── 12–14: user id provenance and service boundary ───────────
test('12. the user id passed to the service is the session user id and nothing else', async () => {
  const w = world()
  const h = harness(w, { userId: OWNER })
  await handleCustomerStoryDelete(h.deps, STORY)
  assert.deepEqual(h.serviceCalls, [{ requestId: STORY, userId: OWNER }])
  // The handler's only other input is the route id: a different session → the other user's id, never the owner's.
  const h2 = harness(world(), { userId: OTHER_USER })
  await handleCustomerStoryDelete(h2.deps, STORY)
  assert.deepEqual(h2.serviceCalls, [{ requestId: STORY, userId: OTHER_USER }])
})

const ROUTE = resolve(ROOT, 'app/api/story/[requestId]/route.ts')
const RESTORE = resolve(ROOT, 'app/api/story/[requestId]/restore/route.ts')
const RETRY = resolve(ROOT, 'app/api/story/[requestId]/retry/route.ts')
const MODULE = resolve(ROOT, 'lib/deletion/customerDeleteRoute.ts')
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
const routeFull = readFileSync(ROUTE, 'utf8')
const routeSrc = stripComments(routeFull)
const deleteStart = routeSrc.indexOf('export async function DELETE')
assert.ok(deleteStart > 0, 'the story route exports DELETE')
/** Executable text of the DELETE handler only (the GET above it legitimately signs storage URLs). */
const deleteSrc = routeSrc.slice(deleteStart)
const moduleSrc = stripComments(readFileSync(MODULE, 'utf8'))

test('13. the request cannot name a user: the DELETE handler reads no body, query, header or cookie value and passes only the route id', () => {
  assert.doesNotMatch(deleteSrc, /\.json\(\)|\.text\(\)|\.formData\(\)|searchParams|nextUrl|headers\.get|cookies\.get|userId:|user_id/, deleteSrc)
  assert.match(deleteSrc, /_request: NextRequest/, 'the request object is unused by name')
  assert.match(deleteSrc, /const \{ requestId \} = await params/)
  assert.match(deleteSrc, /handleCustomerStoryDelete\([\s\S]*?\},\s*requestId,\s*\)/)
  // The handler module itself derives userId from getUserId() only and never from its rawRequestId argument.
  assert.match(moduleSrc, /const userId = await deps\.getUserId\(\)/)
  assert.match(moduleSrc, /deps\.deleteStory\(\{ requestId, userId \}\)/)
  assert.equal((moduleSrc.match(/deps\.deleteStory\(/g) ?? []).length, 1, 'exactly one service call site')
})

test('14. the route calls the 3C-2 service, not the SQL functions or storage: DELETE handler and module hold no rpc, storage, delete or deletion_log code', () => {
  assert.match(deleteSrc, /deleteFailedStory\(createAdminClient\(\) as unknown as StoryDeletionClient, input\)/)
  for (const [name, src] of [['DELETE handler', deleteSrc], ['module', moduleSrc]] as const) {
    assert.doesNotMatch(src, /\.rpc\(|delete_failed_story|complete_story_deletion|release_free|release_purchase|reserve_purchase/, `${name} calls SQL`)
    assert.doesNotMatch(src, /\.storage\b|storage\.from|\.list\(|\.remove\(|story-images|book-exports|STORAGE_|classifyStoragePath|storyPrefix/, `${name} touches storage`)
    assert.doesNotMatch(src, /\.delete\(\)|\.from\(['"]story_requests|\.from\(['"]deletion_log|\.from\(['"]story_purchases|\.update\(/, `${name} mutates rows`)
    assert.doesNotMatch(src, /archived_at|worker_id|updated_at|status === 'failed'|\.eq\(/, `${name} duplicates eligibility`)
  }
  assert.doesNotMatch(routeFull, /delete_failed_story|complete_story_deletion/, 'the whole route file never names the SQL functions')
})

// ── 15–18: concurrency and races ──────────────────────────────
test('15. two simultaneous DELETEs: exactly one completion; the loser gets 202 (never an error) and its retry gets 200', async () => {
  const w = world()
  const h = harness(w)
  const [a, b] = await Promise.all([handleCustomerStoryDelete(h.deps, STORY), handleCustomerStoryDelete(h.deps, STORY)])
  const statuses = [a.status, b.status].sort()
  assert.deepEqual(statuses, [200, 202], `${a.status}/${b.status}`)
  assert.equal(w.calls.rpc.filter((f) => f === 'complete_story_deletion').length, 2, 'both ran the storage pass and both tried to complete')
  assert.deepEqual(w.logs.map((l) => l.status), ['completed'], 'exactly one started → completed transition')
  const loser = a.status === 202 ? h.logs.find((l) => l.status === 202) : h.logs.find((l) => l.status === 202)
  assert.equal(loser?.failureCode, 'complete_not_applied')
  const again = await handleCustomerStoryDelete(h.deps, STORY)
  assert.equal(again.status, 200)
  assert.deepEqual(again.body, { ok: true, state: 'deleted' })
  assert.equal(w.stories.size, 0)
})

test('16. DELETE racing / following the reconciliation sweep is safe: after an incomplete first call, a sweep completion makes the customer retry 200; a sweep racing a retry yields one completion', async () => {
  // a) customer call leaves cleanup pending (202); the storage issue clears; the sweep (same service, same ids) completes; customer retries → 200.
  const w = world({ sticky: [`${STORY}/2.jpg`] })
  const h = harness(w)
  assert.equal((await handleCustomerStoryDelete(h.deps, STORY)).status, 202)
  w.sticky.clear()
  const sweep = await deleteFailedStory(w.client, { requestId: w.logs[0].subject_id, userId: w.logs[0].actor_id })
  assert.equal(sweep.outcome, 'deleted')
  assert.equal((sweep as { completedNow: boolean }).completedNow, true)
  const retry = await handleCustomerStoryDelete(h.deps, STORY)
  assert.equal(retry.status, 200)
  assert.deepEqual(w.logs.map((l) => l.status), ['completed'])

  // b) sweep and customer retry at the same moment: statuses {200 deleted, 202 complete_not_applied} in either order, one completion, then 200.
  const w2 = world({ sticky: [`${STORY}/2.jpg`] })
  const h2 = harness(w2)
  assert.equal((await handleCustomerStoryDelete(h2.deps, STORY)).status, 202)
  w2.sticky.clear()
  const [sweep2, retry2] = await Promise.all([
    deleteFailedStory(w2.client, { requestId: STORY, userId: OWNER }),
    handleCustomerStoryDelete(h2.deps, STORY),
  ])
  const sweepDone = sweep2.outcome === 'deleted' && (sweep2 as { completedNow: boolean }).completedNow
  assert.ok((sweepDone && retry2.status === 202) || (!sweepDone && retry2.status === 200), `sweep=${JSON.stringify(sweep2.outcome)} retry=${retry2.status}`)
  assert.deepEqual(w2.logs.map((l) => l.status), ['completed'])
  assert.equal((await handleCustomerStoryDelete(h2.deps, STORY)).status, 200)
  assert.equal(w2.objects['story-images'].size + w2.objects['book-exports'].size, 0)
})

test('17. restore wins: archived_at cleared before the locked eligibility check → DELETE returns 409 and the story survives', async () => {
  const w = world()
  const h = harness(w)
  assert.equal(w.restore(STORY, OWNER).status, 200)
  const res = await handleCustomerStoryDelete(h.deps, STORY)
  assert.equal(res.status, 409)
  assert.ok(w.stories.has(STORY))
  assert.equal(w.stories.get(STORY)?.archived_at, null)
  assert.equal(w.logs.length, 0)
  assert.equal(w.calls.list, 0)
})

test('18. delete wins: a later restore is 404, never a false success; the hardened restore route returns the touched rows and 404s on zero', async () => {
  const w = world()
  const h = harness(w)
  assert.equal((await handleCustomerStoryDelete(h.deps, STORY)).status, 200)
  assert.equal(w.restore(STORY, OWNER).status, 404)
  assert.equal(w.restore(STORY, OTHER_USER).status, 404)
  // The real route: the UPDATE carries .select('id') and a zero-row result throws NotFoundError (→ 404 via toApiError).
  const restoreSrc = stripComments(readFileSync(RESTORE, 'utf8'))
  assert.match(restoreSrc, /\.update\(\{ archived_at: null, archived_by: null \}\)\s*\.eq\('id', requestId\)\s*\.eq\('user_id', user\.id\)\s*\.select\('id'\)/)
  assert.match(restoreSrc, /if \(!restored \|\| restored\.length === 0\) throw new NotFoundError\('Story'\)/)
  assert.match(restoreSrc, /const \{ data: restored, error \} = await admin/)
  assert.ok(restoreSrc.indexOf("throw new NotFoundError('Story')", restoreSrc.indexOf('.select(\'id\')')) > 0, 'the zero-row check follows the UPDATE')
  assert.doesNotMatch(restoreSrc, /archived_at IS|\.eq\('status'|worker_id|deletion_log|delete_failed_story|updated_at/, 'restore gained no eligibility logic of its own')
  // The retry route's requeue is likewise conditioned on the row still being failed, and a zero-row match is a 404 that never triggers the pipeline.
  const retrySrc = stripComments(readFileSync(RETRY, 'utf8'))
  assert.match(retrySrc, /\.eq\('id', requestId\)\s*\.eq\('status', 'failed'\)\s*\.select\('id'\)/)
  assert.match(retrySrc, /if \(!requeued \|\| requeued\.length === 0\) throw new NotFoundError\('Story request'\)/)
  assert.ok(retrySrc.indexOf('requeued.length === 0') < retrySrc.indexOf('after(async () =>'), 'the zero-row check precedes the pipeline trigger')
})

// ── 19–22: exposure, boundaries ──────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx|mjs|md|mdx|json)$/.test(name)) out.push(p)
  }
  return out
}
const SOURCE_DIRS = ['app', 'components', 'lib', 'hooks', 'middleware.ts', 'supabase/functions', 'docs', 'README.md'].map((d) => resolve(ROOT, d)).filter((p) => { try { statSync(p); return true } catch { return false } })
const SOURCES = SOURCE_DIRS.flatMap((p) => (statSync(p).isDirectory() ? walk(p) : [p]))
const CODE = SOURCES.filter((p) => /\.(ts|tsx|js|jsx|mjs)$/.test(p))

test('19. customer UI boundary (revised by 3C-4): the account deletion module is the only client sender of DELETE /api/story; client files never touch the server deletion modules; the flag is referenced only by the route, the module and the archived page', () => {
  // 3C-4 added the desktop Delete action. Its one request path is
  // lib/account/storyDeletion.ts (pure) used by the account components; no
  // other client code sends DELETE to /api/story.
  const senders = CODE.filter((f) => !f.endsWith('.test.ts') && /method:\s*['"]DELETE['"]/.test(readFileSync(f, 'utf8')) && /\/api\/story\//.test(readFileSync(f, 'utf8')))
  assert.deepEqual(senders, [resolve(ROOT, 'lib/account/storyDeletion.ts')], `DELETE /api/story is sent by ${senders.join(', ')}`)
  for (const f of CODE) {
    if (f.endsWith('.test.ts')) continue
    const src = readFileSync(f, 'utf8')
    if (/['"]use client['"]/.test(src.slice(0, 400))) {
      assert.doesNotMatch(src, /lib\/deletion|customer_story_deletion|handleCustomerStoryDelete/i, `${f} is a client file referencing deletion`)
      // Customer-facing client files that speak of permanent deletion are exactly the 3C-4 account components.
      if (!/\/(app|components)\/admin\//.test(f) && /permanent(ly)? delet/i.test(src)) {
        assert.match(f, /components\/account\/(StoryRowActions|DeleteStoryDialog|StoryList|StoryRow)\.tsx$|components\/account\/useStoryDeletion\.ts$/, `${f} offers permanent deletion to customers outside the account UI`)
      }
    }
  }
  for (const f of ['components/account/StoryRow.tsx', 'components/account/StoryRowActions.tsx', 'components/account/StoryList.tsx']) {
    const src = readFileSync(resolve(ROOT, f), 'utf8')
    assert.match(src, /'archive' \| 'restore'/, `${f} modes`)
    // 3C-5 (phone swipe reveal) is not started: no gesture code in the shared row components.
    assert.doesNotMatch(src, /swipe|touch|pointer|drag|gesture/i, `${f} has gesture UI`)
  }
  for (const f of SOURCES.filter((p) => /\.(md|mdx)$/.test(p))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /DELETE \/api\/story|customer_story_deletion_enabled/, `${f} documents the endpoint`)
  }
  // The flag key is referenced by the route (its header comment), the module, the archived page (3C-4 display switch) and tests only: no admin toggle, no seed row, no migration.
  const flagRefs = CODE.filter((p) => !p.endsWith('.test.ts') && readFileSync(p, 'utf8').includes(CUSTOMER_DELETION_FLAG_KEY))
  assert.deepEqual(flagRefs.sort(), [MODULE, ROUTE, resolve(ROOT, 'app/account/archived/page.tsx')].sort(), `flag key referenced by ${flagRefs.join(', ')}`)
  assert.match(deleteSrc, /isSettingEnabled\(CUSTOMER_DELETION_FLAG_KEY, false\)/, 'the route reads the key via the constant with fallback false')
  assert.match(readFileSync(resolve(ROOT, 'app/account/archived/page.tsx'), 'utf8'), /isSettingEnabled\('customer_story_deletion_enabled', false\)\.catch\(\(\) => false\)/, 'the page reads the key with fallback false and treats a read error as off')
  const migrations = readdirSync(resolve(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql'))
  for (const m of migrations) assert.doesNotMatch(readFileSync(resolve(ROOT, 'supabase/migrations', m), 'utf8'), /customer_story_deletion_enabled/, `${m} seeds the flag`)
})

test('20 + 21. the DELETE handler uses no storage API and no direct deletion RPC (pinned on executable text)', () => {
  assert.doesNotMatch(deleteSrc, /storage/i)
  assert.doesNotMatch(deleteSrc, /rpc|delete_failed_story|complete_story_deletion|\.delete\(/)
  assert.doesNotMatch(moduleSrc, /storage\.|\.rpc\(|supabase|createAdminClient|createClient\(|process\.env/, 'the module builds no client and reads no credential')
  assert.equal((deleteSrc.match(/createAdminClient\(\)/g) ?? []).length, 1, 'exactly one admin client, handed to the service')
})

test('22. server-only / admin-client boundary: the module and route are server files, imported by no client file; lib/deletion is imported only by the two routes', () => {
  assert.doesNotMatch(readFileSync(MODULE, 'utf8'), /['"]use client['"]/)
  assert.doesNotMatch(routeFull, /['"]use client['"]/)
  assert.match(moduleSrc, /assertServerOnly\(\)/)
  for (const m of moduleSrc.matchAll(/^import\s[\s\S]*?from\s+'([^']+)'/gm)) assert.ok(m[1].startsWith('./'), `module imports ${m[1]}`)
  const clientFiles = CODE.filter((p) => /['"]use client['"]/.test(readFileSync(p, 'utf8').slice(0, 400)))
  for (const f of clientFiles) assert.doesNotMatch(readFileSync(f, 'utf8'), /lib\/deletion|customerDeleteRoute|handleCustomerStoryDelete/, `${f} imports a deletion module`)
  const importers = CODE.filter((p) => !p.startsWith(resolve(ROOT, 'lib/deletion')) && /lib\/deletion\/|from '\.\.?\/deletion/.test(readFileSync(p, 'utf8'))).sort()
  assert.deepEqual(importers, [resolve(ROOT, 'app/api/cron/deletion-sweep/route.ts'), ROUTE].sort())
  assert.match(deleteSrc, /const supabase = await createClient\(\)[\s\S]*?supabase\.auth\.getUser\(\)[\s\S]*?return user\?\.id \?\? null/, 'auth via the cookie session client')
  assert.match(deleteSrc, /return NextResponse\.json\(body, \{ status \}\)/)
  assert.doesNotMatch(deleteSrc, /try\s*\{|catch/, 'no second error path: the handler maps every throw to 500 itself')
})

// ── 23–26: untouched files, pinned by content hash at main 335d179 ──
const sha = (rel: string) => createHash('sha256').update(readFileSync(resolve(ROOT, rel))).digest('hex')
test('23. the 3C-6 cron (route, sweep module, vercel.json schedule) is untouched', () => {
  assert.equal(sha('app/api/cron/deletion-sweep/route.ts'), '1a77481e9d2104fb3a2329bf2a5f05dd7e0ca0455dc3e329291c5a1172adbb67')
  assert.equal(sha('lib/deletion/reconcileStartedDeletions.ts'), '5c03f76721a79c4cb37db9e8fa52efb912f2e7f83b26729d50e7fdd56e61a55b')
  assert.equal(sha('vercel.json'), 'bf170f51c6a40599535816fe56445c1cc718678d088ab23d8705fc093c9e0da4')
  assert.match(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'), /"path": "\/api\/cron\/deletion-sweep",\s*"schedule": "30 10 \* \* \*"/)
})

test('24. migrations 20240073/74/75 are untouched and no migration was added', () => {
  assert.equal(sha('supabase/migrations/20240073_deletion_schema_foundation.sql'), '1a75a2f72346b3dc9cda36f6aba9ee56c0f3e20858961f87b55ac88d7c2f2827')
  assert.equal(sha('supabase/migrations/20240074_failed_story_deletion.sql'), 'dbb996df4f7a502bfd196f5f8fbb9046f89d4457b23d90b85f199ce9fb6427fe')
  assert.equal(sha('supabase/migrations/20240075_deletion_count_durability.sql'), '437b93cbd4a2f1a2672ad59eb5d65e7c3fba7c71cf318e00256e00c969bfca08')
  assert.equal(readdirSync(resolve(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort().at(-1), '20240075_deletion_count_durability.sql')
})

test('25. supabase/functions/process-story is untouched (22 files, combined content hash)', () => {
  const dir = resolve(ROOT, 'supabase/functions/process-story')
  const files = walk(dir).sort()
  assert.equal(files.length, 22)
  const h = createHash('sha256')
  for (const f of files) h.update(readFileSync(f))
  assert.equal(h.digest('hex'), '012a4fd51cae342523424ff987e3d355f5c064ba1d35f452bc12fcaa500d9756')
})

test('26. the legal files are at their expected revision (lib/i18n/legal.ts as updated by 3C-8; privacy and terms pages and LegalDocument untouched)', () => {
  // 3C-8 (2026-10-16) rewrote the deletion disclosure; lib/i18n/legal.test.ts owns the legal text from here.
  assert.equal(sha('lib/i18n/legal.ts'), '0e4ccfae77d0ea338f539c24df85ef0f878a1d7c0832301bb44e75b42eea9e2c')
  assert.equal(sha('app/privacy/page.tsx'), '13d488e16745236312aa3434f49c119fd033cda9e58ecc7ccccd5613476ed9b8')
  assert.equal(sha('app/terms/page.tsx'), 'f46063029254657a86e72d0ac2581c5fbffc7753fc4623d7e4bfb0aa37156fd9')
  assert.equal(sha('components/legal/LegalDocument.tsx'), '0a3e14e511d2cf72bf9f11428453f6584e00d52fb50b3a8bc65934777566430a')
})

// ── 27: exposure gate ─────────────────────────────────────────
test('27. exposure gate: while customer_story_deletion_enabled is not true, every caller gets the generic 404 before auth and the service is never called', async () => {
  for (const flag of [false, undefined, null, 'true', 1, 'yes'] as unknown[]) {
    for (const userId of [OWNER, OTHER_USER, null]) {
      let authCalls = 0
      const w = world()
      const h = harness(w, { enabled: async () => flag as boolean, userId: async () => { authCalls++; return userId } })
      const res = await handleCustomerStoryDelete(h.deps, STORY)
      assert.equal(res.status, 404, `flag=${JSON.stringify(flag)} user=${userId}`)
      assert.deepEqual(res.body, NOT_FOUND)
      assert.equal(authCalls, 0, 'the gate is evaluated before the session is read')
      assert.equal(h.serviceCalls.length, 0)
      assert.ok(w.stories.has(STORY))
      assert.deepEqual(h.logs.map((l) => l.outcome), ['disabled'])
    }
  }
  // With the flag on, the same call deletes. isSettingEnabled('…', false) in the route maps the JSONB true / "true" to true and anything else to false.
  const w = world()
  const h = harness(w, { enabled: true })
  assert.equal((await handleCustomerStoryDelete(h.deps, STORY)).status, 200)
  assert.equal(CUSTOMER_DELETION_FLAG_KEY, 'customer_story_deletion_enabled')
  const gates = readFileSync(resolve(ROOT, 'lib/settings/gates.ts'), 'utf8')
  assert.match(gates, /export async function isSettingEnabled\(key: string, fallback = true\)/)
  assert.match(gates, /if \(error \|\| !data\) return fallback/.test(readFileSync(resolve(ROOT, 'lib/settings/appSettings.ts'), 'utf8')) ? /isSettingEnabled/ : /NEVER/, 'getSetting returns the fallback (false) when the row is missing')
})

// ── Mapping table (pure) ──────────────────────────────────────
test('28. the outcome → HTTP table is total and explicit', () => {
  const table: Record<CustomerDeleteOutcome, number> = {
    disabled: 404, malformed_id: 404, not_found: 404, unauthenticated: 401, not_eligible: 409,
    deleted: 200, already_deleted: 200, cleanup_pending: 202, rpc_failed: 500, error: 500,
  }
  for (const [outcome, status] of Object.entries(table)) assert.equal(responseFor(outcome as CustomerDeleteOutcome).status, status, outcome)
  assert.deepEqual(responseFor('deleted').body, responseFor('already_deleted').body)
  assert.deepEqual(responseFor('disabled').body, responseFor('not_found').body)
  assert.deepEqual(responseFor('malformed_id').body, responseFor('not_found').body)
  assert.deepEqual(classifyServiceResult({ outcome: 'deleted', logId: uuid(1), resumed: true, completedNow: false, freeReleased: false, storageObjectsRemoved: 0, counts: {}, rejectedKnownPaths: [] }), { outcome: 'already_deleted' })
  assert.deepEqual(classifyServiceResult({ outcome: 'incomplete', retryable: true, logId: uuid(1), resumed: false, stage: 'complete', failureCode: 'complete_not_applied', detail: 'x', storageObjectsRemoved: 1, remainingObjects: 0 }), { outcome: 'cleanup_pending', failureCode: 'complete_not_applied' })
})
