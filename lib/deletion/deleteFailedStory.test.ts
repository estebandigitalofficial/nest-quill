// 3C-2 failed-story deletion service: behaviour over a fake Supabase client
// plus source contracts (server-only, no production caller, counts allow-list
// pinned to migration 20240073). Never touches a database or a bucket.
// Run: node --experimental-strip-types --test lib/deletion/deleteFailedStory.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  STORAGE_LIST_PAGE_SIZE,
  STORAGE_REMOVE_BATCH_SIZE,
  deleteFailedStory,
  listStoryObjects,
  type StoryDeletionClient,
  type StorageListEntry,
} from './deleteFailedStory.ts'
import { DELETION_COUNT_KEYS, STORAGE_OBJECTS_COUNT_KEY, parseDeleteRpcResult, sanitizeCounts, withStorageCount } from './decision.ts'
import { classifyStoragePath, dedupeObjects, normalizeRequestId, partitionKnownPaths, storyPrefix } from './storagePaths.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const STORY = '11111111-2222-4333-8444-555555555555'
const OTHER = '99999999-8888-4777-8666-555555555555'
const USER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const LOG = 'f0f0f0f0-0000-4000-8000-000000000001'
const DB_COUNTS = { story_requests: 1, generated_stories: 1, story_scenes: 8, book_exports: 1, delivery_logs: 2, processing_logs: 30, image_library: 8, purchases_detached: 0, idempotency_keys: 1, drip_email_log: 0, notifications: 1 }

// ── Fake client ──────────────────────────────────────────────
interface FakeOptions {
  objects?: Record<string, string[]> // bucket → full paths present
  deleteResult?: unknown | (() => unknown)
  deleteError?: string
  completeResult?: unknown
  completeError?: string
  removeError?: (bucket: string, batch: string[]) => string | null
  listError?: (bucket: string, call: number) => string | null
  /** paths that remove() silently fails to delete (simulates a stale/late upload or a partial failure) */
  sticky?: string[]
}
function fake(opts: FakeOptions = {}) {
  const objects: Record<string, Set<string>> = {}
  for (const [b, paths] of Object.entries(opts.objects ?? {})) objects[b] = new Set(paths)
  const calls: { rpc: Array<{ fn: string; args: Record<string, unknown> | undefined }>; list: Array<{ bucket: string; path: string | undefined; offset: number }>; remove: Array<{ bucket: string; paths: string[] }> } = { rpc: [], list: [], remove: [] }
  let listCalls = 0
  const client: StoryDeletionClient = {
    async rpc(fn, args) {
      calls.rpc.push({ fn, args })
      if (fn === 'delete_failed_story') {
        if (opts.deleteError) return { data: null, error: { message: opts.deleteError } }
        const r = typeof opts.deleteResult === 'function' ? (opts.deleteResult as () => unknown)() : opts.deleteResult
        return { data: r, error: null }
      }
      if (fn === 'complete_story_deletion') {
        if (opts.completeError) return { data: null, error: { message: opts.completeError } }
        return { data: opts.completeResult === undefined ? true : opts.completeResult, error: null }
      }
      throw new Error(`unexpected rpc ${fn}`)
    },
    storage: {
      from(bucket) {
        return {
          async list(path, options) {
            const n = ++listCalls
            const err = opts.listError?.(bucket, n)
            if (err) return { data: null, error: { message: err } }
            const offset = options?.offset ?? 0
            const limit = options?.limit ?? 100
            calls.list.push({ bucket, path, offset })
            const prefix = path ? `${path}/` : ''
            const names = new Set<string>()
            const folders = new Set<string>()
            for (const p of objects[bucket] ?? []) {
              if (!p.startsWith(prefix)) continue
              const rest = p.slice(prefix.length)
              const slash = rest.indexOf('/')
              if (slash === -1) names.add(rest)
              else folders.add(rest.slice(0, slash))
            }
            const entries: StorageListEntry[] = [
              ...[...folders].sort().map((name) => ({ name, id: null })),
              ...[...names].sort().map((name, i) => ({ name, id: `obj-${name}-${i}` })),
            ]
            return { data: entries.slice(offset, offset + limit), error: null }
          },
          async remove(paths) {
            calls.remove.push({ bucket, paths: [...paths] })
            const err = opts.removeError?.(bucket, paths)
            if (err) return { data: null, error: { message: err } }
            const removed: unknown[] = []
            for (const p of paths) {
              if (opts.sticky?.includes(p)) continue
              if (objects[bucket]?.delete(p)) removed.push({ name: p })
            }
            return { data: removed, error: null }
          },
        }
      },
    },
  }
  return { client, calls, objects }
}
const freshDeleted = (known: unknown[] = [], counts: unknown = DB_COUNTS) => ({ outcome: 'deleted', resumed: false, log_id: LOG, known_paths: known, counts, free_released: true })
// Under 20240075 a resumed call returns the database counts stored durably on the deletion_log record.
const resumedDeleted = (counts: unknown = DB_COUNTS) => ({ outcome: 'deleted', resumed: true, log_id: LOG, known_paths: [], counts, free_released: false })
const storyObjects = (id = STORY) => ({
  'story-images': [`${id}/1.jpg`, `${id}/2.jpg`, `${id}/3.png`, `${id}/cover.jpg`],
  'book-exports': [`${id}/storybook.pdf`],
})
const allObjects = (f: ReturnType<typeof fake>) => Object.fromEntries(Object.entries(f.objects).map(([b, s]) => [b, [...s].sort()]))

// ── Behaviour ────────────────────────────────────────────────
test('1. not_found remains privacy-safe: unknown id, other owner and malformed id are byte-identical and touch no storage', async () => {
  const f = fake({ deleteResult: { outcome: 'not_found' }, objects: storyObjects() })
  const a = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  const b = await deleteFailedStory(f.client, { requestId: 'not-a-uuid', userId: USER })
  const c = await deleteFailedStory(f.client, { requestId: STORY, userId: '' })
  assert.deepEqual(a, { outcome: 'not_found' })
  assert.deepEqual(b, a)
  assert.deepEqual(c, a)
  assert.equal(f.calls.rpc.length, 1, 'malformed ids never reach the database')
  assert.equal(f.calls.list.length + f.calls.remove.length, 0)
  assert.deepEqual(allObjects(f), storyObjects())
})

test('2. not_eligible is a distinct result and touches no storage', async () => {
  const f = fake({ deleteResult: { outcome: 'not_eligible' }, objects: storyObjects() })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.deepEqual(r, { outcome: 'not_eligible' })
  assert.equal(f.calls.list.length + f.calls.remove.length, 0)
  assert.deepEqual(allObjects(f), storyObjects())
})

test('3. fresh deleted outcome removes every story object, verifies, then completes with db counts + storage_objects', async () => {
  const known = [{ bucket: 'story-images', path: `${STORY}/1.jpg` }, { bucket: 'book-exports', path: `${STORY}/storybook.pdf` }]
  const f = fake({ deleteResult: freshDeleted(known), objects: { ...storyObjects(), ...{ 'story-images': [...storyObjects()['story-images'], `${OTHER}/1.jpg`] } } })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'deleted')
  if (r.outcome !== 'deleted') return
  assert.equal(r.completedNow, true)
  assert.equal(r.resumed, false)
  assert.equal(r.freeReleased, true)
  assert.equal(r.storageObjectsRemoved, 5)
  assert.deepEqual(r.counts, { ...DB_COUNTS, storage_objects: 5 })
  assert.deepEqual(allObjects(f), { 'story-images': [`${OTHER}/1.jpg`], 'book-exports': [] })
  const complete = f.calls.rpc.find((c) => c.fn === 'complete_story_deletion')
  assert.deepEqual(complete?.args, { p_log_id: LOG, p_counts: { ...DB_COUNTS, storage_objects: 5 } })
})

test('4. resumed deletion cleans both prefixes even though known_paths is empty, and keeps the durable counts', async () => {
  const f = fake({ deleteResult: resumedDeleted(), objects: storyObjects() })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'deleted')
  if (r.outcome !== 'deleted') return
  assert.equal(r.resumed, true)
  assert.equal(r.storageObjectsRemoved, 5)
  assert.deepEqual(r.counts, { ...DB_COUNTS, storage_objects: 5 })
  assert.deepEqual(allObjects(f), { 'story-images': [], 'book-exports': [] })
})

test('5. already_deleted is idempotent success: no listing, no removal, nothing unrelated touched', async () => {
  const f = fake({ deleteResult: { outcome: 'already_deleted', log_id: LOG }, objects: storyObjects(OTHER) })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'deleted')
  if (r.outcome !== 'deleted') return
  assert.equal(r.completedNow, false)
  assert.equal(r.logId, LOG)
  assert.equal(f.calls.list.length + f.calls.remove.length, 0)
  assert.equal(f.calls.rpc.length, 1)
  assert.deepEqual(allObjects(f), storyObjects(OTHER))
})

test('6. both story-images and book-exports prefixes are enumerated, with the exact folder and sort', async () => {
  const f = fake({ deleteResult: freshDeleted(), objects: storyObjects() })
  await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  const buckets = [...new Set(f.calls.list.map((c) => c.bucket))].sort()
  assert.deepEqual(buckets, ['book-exports', 'story-images'])
  for (const c of f.calls.list) assert.equal(c.path, STORY, 'listed exactly the story folder')
  // discovery pass + verification pass per bucket
  assert.equal(f.calls.list.filter((c) => c.bucket === 'story-images').length, 2)
  assert.equal(f.calls.list.filter((c) => c.bucket === 'book-exports').length, 2)
})

test('7. pagination discovers more than one page and stops at the short page', async () => {
  const many = Array.from({ length: STORAGE_LIST_PAGE_SIZE * 2 + 7 }, (_, i) => `${STORY}/${i + 1}.jpg`)
  const f = fake({ deleteResult: freshDeleted(), objects: { 'story-images': many, 'book-exports': [] } })
  const found = await listStoryObjects(f.client, 'story-images', STORY)
  assert.equal(found.length, many.length)
  const offsets = f.calls.list.filter((c) => c.bucket === 'story-images').map((c) => c.offset)
  assert.deepEqual(offsets, [0, STORAGE_LIST_PAGE_SIZE, STORAGE_LIST_PAGE_SIZE * 2])
  f.calls.list.length = 0
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'deleted')
  if (r.outcome !== 'deleted') return
  assert.equal(r.storageObjectsRemoved, many.length)
  assert.deepEqual(allObjects(f)['story-images'], [])
  // removal was batched
  const batches = f.calls.remove.filter((c) => c.bucket === 'story-images')
  assert.equal(batches.length, Math.ceil(many.length / STORAGE_REMOVE_BATCH_SIZE))
  for (const b of batches) assert.ok(b.paths.length <= STORAGE_REMOVE_BATCH_SIZE)
})

test('8. only exact requestId-owned prefixes are eligible', () => {
  assert.equal(storyPrefix(STORY), `${STORY}/`)
  assert.equal(classifyStoragePath('story-images', `${STORY}/1.jpg`, STORY).ok, true)
  assert.equal(classifyStoragePath('story-images', `${STORY}/cover.png`, STORY).ok, true)
  assert.equal(classifyStoragePath('book-exports', `${STORY}/storybook.pdf`, STORY).ok, true)
  // prefix boundary: no slash, longer id, shorter id, different id, nested under another story
  for (const bad of [`${STORY}1.jpg`, `${STORY}0/1.jpg`, `${STORY.slice(0, 35)}/1.jpg`, `${OTHER}/1.jpg`, `${OTHER}/${STORY}/1.jpg`, `x/${STORY}/1.jpg`]) {
    const c = classifyStoragePath('story-images', bad, STORY)
    assert.equal(c.ok, false, bad)
    if (!c.ok) assert.equal(c.reason, 'path_outside_story_prefix', bad)
  }
  assert.deepEqual(classifyStoragePath('story-images', STORY, STORY), { ok: false, reason: 'path_outside_story_prefix' })
  assert.deepEqual(classifyStoragePath('story-images', `${STORY}/`, STORY), { ok: false, reason: 'path_is_bare_prefix' })
  assert.deepEqual(classifyStoragePath('avatars', `${STORY}/1.jpg`, STORY), { ok: false, reason: 'bucket_not_allowed' })
  assert.deepEqual(classifyStoragePath('writer-files', `${STORY}/1.jpg`, STORY), { ok: false, reason: 'bucket_not_allowed' })
  assert.equal(normalizeRequestId(STORY.toUpperCase()), STORY)
  assert.equal(normalizeRequestId(`${STORY}/`), null)
  assert.equal(normalizeRequestId(null), null)
})

test('9. unsafe known_path from the database is rejected, never removed, and reported', async () => {
  const known = [
    { bucket: 'story-images', path: `${OTHER}/1.jpg` }, // another story
    { bucket: 'avatars', path: `${STORY}/1.jpg` }, // bucket not allowed
    { bucket: 'story-images', path: 42 }, // not a string
    { bucket: 'story-images', path: `${STORY}/1.jpg` }, // fine
    'garbage',
    null,
  ]
  const f = fake({ deleteResult: freshDeleted(known), objects: { 'story-images': [`${STORY}/1.jpg`, `${OTHER}/1.jpg`], 'book-exports': [] } })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'deleted')
  if (r.outcome !== 'deleted') return
  assert.deepEqual(r.rejectedKnownPaths.map((x) => x.reason), ['path_outside_story_prefix', 'bucket_not_allowed', 'path_not_string', 'bucket_not_allowed', 'bucket_not_allowed'])
  assert.deepEqual(allObjects(f), { 'story-images': [`${OTHER}/1.jpg`], 'book-exports': [] })
  for (const c of f.calls.remove) for (const p of c.paths) assert.ok(p.startsWith(`${STORY}/`))
})

test('10. traversal-style and malformed paths are rejected', () => {
  const cases: Array<[string, string]> = [
    [`${STORY}/../${OTHER}/1.jpg`, 'path_has_dot_segment'],
    [`${STORY}/./1.jpg`, 'path_has_dot_segment'],
    [`${STORY}/..`, 'path_has_dot_segment'],
    [`${STORY}//1.jpg`, 'path_has_empty_segment'],
    [`${STORY}/1.jpg/`, 'path_has_empty_segment'],
    [`/${STORY}/1.jpg`, 'path_has_forbidden_characters'],
    [`${STORY}\\1.jpg`, 'path_has_forbidden_characters'],
    [`${STORY}/1.jpg\u0000`, 'path_has_forbidden_characters'],
    [`${STORY}/` + 'a'.repeat(300), 'path_too_long'],
    ['', 'path_too_long'],
  ]
  for (const [p, reason] of cases) assert.deepEqual(classifyStoragePath('story-images', p, STORY), { ok: false, reason }, p)
  assert.throws(() => storyPrefix('../x'))
})

test('11. objects from another story are never removed, even when the listing fake returns them', async () => {
  // A hostile/odd listing: the client returns entries whose names escape the folder.
  const f = fake({ deleteResult: freshDeleted(), objects: storyObjects() })
  const inner = f.client.storage.from.bind(f.client.storage)
  f.client.storage = {
    from(bucket) {
      const api = inner(bucket)
      return {
        ...api,
        async list(path, options) {
          const r = await api.list(path, options)
          if (bucket === 'story-images' && (options?.offset ?? 0) === 0 && r.data) r.data = [...r.data, { name: `../${OTHER}/1.jpg`, id: 'evil' }, { name: '', id: 'empty' }]
          return r
        },
      }
    },
  }
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'deleted')
  for (const c of f.calls.remove) for (const p of c.paths) assert.ok(p.startsWith(`${STORY}/`) && !p.includes('..'), p)
})

test('12. known_paths and discovered paths are deduplicated before removal', async () => {
  const known = [
    { bucket: 'story-images', path: `${STORY}/1.jpg` },
    { bucket: 'story-images', path: `${STORY}/1.jpg` },
    { bucket: 'book-exports', path: `${STORY}/storybook.pdf` },
    { bucket: 'story-images', path: `${STORY}/legacy-only.png` }, // known but not present
  ]
  const f = fake({ deleteResult: freshDeleted(known), objects: storyObjects() })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  const sent = f.calls.remove.flatMap((c) => c.paths.map((p) => `${c.bucket}:${p}`))
  assert.equal(new Set(sent).size, sent.length, 'no path sent twice')
  assert.equal(sent.length, 6, '5 present + 1 known-only')
  assert.equal(r.outcome, 'deleted')
  if (r.outcome === 'deleted') assert.equal(r.storageObjectsRemoved, 5, 'count is objects that existed, not paths sent')
  assert.deepEqual(dedupeObjects([{ bucket: 'story-images', path: 'a/1' }, { bucket: 'story-images', path: 'a/1' }, { bucket: 'book-exports', path: 'a/1' }]).length, 2)
})

test('13. storage remove failure leaves the deletion incomplete and retryable; completion is never called', async () => {
  const f = fake({ deleteResult: freshDeleted(), objects: storyObjects(), removeError: () => 'storage down' })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'incomplete')
  if (r.outcome !== 'incomplete') return
  assert.equal(r.retryable, true)
  assert.equal(r.stage, 'storage_remove')
  assert.equal(r.failureCode, 'storage_remove_failed')
  assert.equal(r.logId, LOG)
  assert.ok(!f.calls.rpc.some((c) => c.fn === 'complete_story_deletion'))
  assert.deepEqual(allObjects(f), storyObjects())
})

test('14. partial storage removal (second bucket fails) stays retryable, and the retry finishes the job', async () => {
  let fail = true
  const f = fake({
    deleteResult: () => (fail ? freshDeleted() : resumedDeleted()),
    objects: storyObjects(),
    removeError: (bucket) => (fail && bucket === 'book-exports' ? 'transient' : null),
  })
  const first = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(first.outcome, 'incomplete')
  if (first.outcome === 'incomplete') {
    assert.equal(first.stage, 'storage_remove')
    assert.equal(first.storageObjectsRemoved, 4, 'the story-images batch went through')
  }
  assert.deepEqual(allObjects(f), { 'story-images': [], 'book-exports': [`${STORY}/storybook.pdf`] })
  assert.ok(!f.calls.rpc.some((c) => c.fn === 'complete_story_deletion'))
  fail = false
  const second = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(second.outcome, 'deleted')
  if (second.outcome === 'deleted') {
    assert.equal(second.resumed, true)
    assert.equal(second.storageObjectsRemoved, 1)
    assert.deepEqual(second.counts, { ...DB_COUNTS, storage_objects: 1 }, 'resumed run forwards the durable database counts plus storage_objects for THIS invocation only (the 4 objects the first run removed are not re-counted: accepted limitation)')
  }
  assert.deepEqual(allObjects(f), { 'story-images': [], 'book-exports': [] })
})

test('15. a re-list that still finds an object prevents completion', async () => {
  const f = fake({ deleteResult: freshDeleted(), objects: storyObjects(), sticky: [`${STORY}/2.jpg`] })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'incomplete')
  if (r.outcome !== 'incomplete') return
  assert.equal(r.stage, 'storage_verify')
  assert.equal(r.failureCode, 'storage_objects_remain')
  assert.equal(r.remainingObjects, 1)
  assert.ok(!f.calls.rpc.some((c) => c.fn === 'complete_story_deletion'))
})

test('16. empty prefixes permit completion (a story that never produced an object)', async () => {
  const f = fake({ deleteResult: freshDeleted([], { story_requests: 1 }), objects: { 'story-images': [`${OTHER}/1.jpg`], 'book-exports': [] } })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'deleted')
  if (r.outcome !== 'deleted') return
  assert.equal(r.storageObjectsRemoved, 0)
  assert.deepEqual(r.counts, { story_requests: 1, storage_objects: 0 })
  assert.equal(f.calls.remove.length, 0, 'nothing to remove, remove() never called')
  assert.deepEqual(allObjects(f), { 'story-images': [`${OTHER}/1.jpg`], 'book-exports': [] })
})

test('17. complete_story_deletion false, error or unexpected value is never reported as deleted', async () => {
  for (const [opt, code] of [[{ completeResult: false }, 'complete_not_applied'], [{ completeResult: 'yes' }, 'complete_not_applied'], [{ completeError: 'boom' }, 'complete_rpc_error']] as const) {
    const f = fake({ deleteResult: freshDeleted(), objects: storyObjects(), ...opt })
    const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
    assert.equal(r.outcome, 'incomplete')
    if (r.outcome === 'incomplete') {
      assert.equal(r.stage, 'complete')
      assert.equal(r.failureCode, code)
      assert.equal(r.retryable, true)
      assert.equal(r.remainingObjects, 0)
    }
  }
  // the first rpc failing changes nothing and is reported distinctly
  const g = fake({ deleteError: 'connection refused', objects: storyObjects() })
  const r = await deleteFailedStory(g.client, { requestId: STORY, userId: USER })
  assert.deepEqual(r, { outcome: 'rpc_failed', retryable: true, failureCode: 'delete_rpc_error', detail: 'connection refused' })
  assert.deepEqual(allObjects(g), storyObjects())
  const h = fake({ deleteResult: { outcome: 'surprise' }, objects: storyObjects() })
  const m = await deleteFailedStory(h.client, { requestId: STORY, userId: USER })
  assert.equal(m.outcome, 'rpc_failed')
  if (m.outcome === 'rpc_failed') assert.equal(m.failureCode, 'delete_rpc_malformed')
  assert.equal(h.calls.list.length, 0)
})

test('18. completion is called only after a verified-empty re-list, in order: delete, list, remove, list, complete', async () => {
  const f = fake({ deleteResult: freshDeleted(), objects: storyObjects() })
  const order: string[] = []
  const inner = f.client
  const spy: StoryDeletionClient = {
    rpc: (fn, args) => { order.push(`rpc:${fn}`); return inner.rpc(fn, args) },
    storage: { from(bucket) { const api = inner.storage.from(bucket); return { list: (p, o) => { order.push(`list:${bucket}`); return api.list(p, o) }, remove: (p) => { order.push(`remove:${bucket}`); return api.remove(p) } } } },
  }
  const r = await deleteFailedStory(spy, { requestId: STORY, userId: USER })
  assert.equal(r.outcome, 'deleted')
  const lastList = order.lastIndexOf('list:book-exports')
  const complete = order.indexOf('rpc:complete_story_deletion')
  assert.equal(order[0], 'rpc:delete_failed_story')
  assert.ok(order.indexOf('remove:story-images') > order.indexOf('list:story-images'))
  assert.ok(lastList < complete && complete === order.length - 1, order.join(' > '))
  assert.equal(order.filter((x) => x.startsWith('list:')).length, 4, 'two discovery + two verification listings')
})

test('19. the storage count uses the existing allow-listed deletion_log key, and the allow-list matches 20240073 exactly', () => {
  assert.equal(STORAGE_OBJECTS_COUNT_KEY, 'storage_objects')
  const sql = readFileSync(resolve(ROOT, 'supabase/migrations/20240073_deletion_schema_foundation.sql'), 'utf8')
  const fn = sql.match(/CREATE OR REPLACE FUNCTION public\.deletion_log_counts_ok[\s\S]*?\$\$;/)![0]
  const allowList = fn.match(/kv\.key NOT IN \(([\s\S]*?)\)\s*OR jsonb_typeof/)![1]
  const keys = [...allowList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  assert.deepEqual([...DELETION_COUNT_KEYS], keys, 'DELETION_COUNT_KEYS must mirror deletion_log_counts_ok() byte for byte')
  assert.deepEqual(withStorageCount({ story_requests: 1 }, 3), { story_requests: 1, storage_objects: 3 })
  assert.throws(() => withStorageCount({}, -1))
  assert.throws(() => withStorageCount({}, 1.5))
  // unknown keys and bad values are dropped, never forwarded
  assert.deepEqual(sanitizeCounts({ story_requests: 1, bogus: 2, story_scenes: -1, book_exports: '3' }), { counts: { story_requests: 1 }, dropped: ['bogus', 'story_scenes', 'book_exports'] })
})

test('20. resumed deletion preserves the 20240075 durable counts and fabricates none absent from the RPC', async () => {
  // Full durable set comes back from deletion_log → forwarded unchanged + storage_objects.
  const f = fake({ deleteResult: resumedDeleted(), objects: storyObjects() })
  const r = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  const complete = f.calls.rpc.find((c) => c.fn === 'complete_story_deletion')
  assert.deepEqual(complete?.args, { p_log_id: LOG, p_counts: { ...DB_COUNTS, storage_objects: 5 } })
  assert.equal(r.outcome, 'deleted')
  if (r.outcome === 'deleted') assert.equal(r.resumed, true)
  // A partial set (or a legacy {} record) is forwarded exactly as returned: no key is invented.
  const partial = { story_requests: 1, story_scenes: 8 }
  const g = fake({ deleteResult: resumedDeleted(partial), objects: storyObjects() })
  await deleteFailedStory(g.client, { requestId: STORY, userId: USER })
  assert.deepEqual(g.calls.rpc.find((c) => c.fn === 'complete_story_deletion')?.args, { p_log_id: LOG, p_counts: { ...partial, storage_objects: 5 } })
  const h = fake({ deleteResult: resumedDeleted({}), objects: storyObjects() })
  await deleteFailedStory(h.client, { requestId: STORY, userId: USER })
  assert.deepEqual(h.calls.rpc.find((c) => c.fn === 'complete_story_deletion')?.args, { p_log_id: LOG, p_counts: { storage_objects: 5 } })
  const p = parseDeleteRpcResult(resumedDeleted(partial))
  assert.equal(p.outcome, 'deleted')
  if (p.outcome === 'deleted') assert.deepEqual(p.counts, partial)
})

test('23. crash after the database delete: the durable counts survive to the final complete_story_deletion alongside storage_objects', async () => {
  // Run 1: fresh deletion, storage removal dies before anything is removed (process "crashes" before completion).
  let crashed = true
  const log: Record<string, unknown> = { status: 'started', counts: {} }
  const f = fake({
    deleteResult: () => {
      if (crashed) return freshDeleted()
      // 20240075: the deleting transaction stored the counts; the resumed branch reads them back.
      return resumedDeleted(log.counts)
    },
    objects: storyObjects(),
    removeError: () => (crashed ? 'process died' : null),
  })
  // Model the 20240075 behaviour of delete_failed_story persisting counts on the started record.
  log.counts = DB_COUNTS
  const first = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(first.outcome, 'incomplete')
  assert.ok(!f.calls.rpc.some((c) => c.fn === 'complete_story_deletion'), 'nothing completed')
  assert.deepEqual(allObjects(f), storyObjects(), 'nothing removed')
  // Run 2 (the reconciliation retry): resumed, known_paths empty, durable counts returned.
  crashed = false
  const second = await deleteFailedStory(f.client, { requestId: STORY, userId: USER })
  assert.equal(second.outcome, 'deleted')
  if (second.outcome !== 'deleted') return
  assert.equal(second.resumed, true)
  const complete = f.calls.rpc.find((c) => c.fn === 'complete_story_deletion')
  assert.deepEqual(complete?.args, { p_log_id: LOG, p_counts: { ...DB_COUNTS, storage_objects: 5 } }, 'final completion carries every original database count plus storage_objects')
  for (const k of Object.keys(DB_COUNTS)) assert.equal((complete?.args?.p_counts as Record<string, number>)[k], (DB_COUNTS as Record<string, number>)[k])
  assert.deepEqual(allObjects(f), { 'story-images': [], 'book-exports': [] })
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
const DELETION_FILES = ['deleteFailedStory.ts', 'storagePaths.ts', 'decision.ts'].map((f) => resolve(ROOT, 'lib/deletion', f))

test('21. no production caller: no route, page, component, worker or cron calls the service or the SQL functions', () => {
  const importers = SOURCES.filter((p) => !p.startsWith(resolve(ROOT, 'lib/deletion')) && /lib\/deletion\/|from '\.\.?\/deletion/.test(readFileSync(p, 'utf8')))
  assert.deepEqual(importers, [], 'lib/deletion is imported outside itself')
  const rpcCallers = SOURCES.filter((p) => !DELETION_FILES.includes(p) && !p.endsWith('.test.ts') && /delete_failed_story|complete_story_deletion/.test(readFileSync(p, 'utf8')))
  assert.deepEqual(rpcCallers, [], 'the 20240074/20240075 functions are called from a non-deletion module')
  // no customer deletion route exists
  const routes = SOURCES.filter((p) => /app\/api\/.*route\.tsx?$/.test(p) && /export (async )?function DELETE/.test(readFileSync(p, 'utf8')))
  assert.ok(!routes.some((p) => /\/story\//.test(p)), `a DELETE handler exists under /api/story: ${routes.join(', ')}`)
  // this file set changed nothing in the migrations directory
  assert.equal(readdirSync(resolve(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort().at(-1), '20240075_deletion_count_durability.sql', 'no new migration in 3C-2')
})

test('22. privileged code is server-only: no client directive, no browser-safe module imports it, admin client never imported here', () => {
  for (const file of DELETION_FILES) {
    const src = readFileSync(file, 'utf8')
    assert.doesNotMatch(src, /['"]use client['"]/, `${file} is marked use client`)
    assert.doesNotMatch(src, /process\.env\.|SUPABASE_SERVICE_ROLE_KEY|createClient\(/, `${file} must not read env or build a client; the caller injects the admin client`)
    // only relative imports and the type-only supabase import are allowed
    for (const m of src.matchAll(/^import\s[\s\S]*?from\s+'([^']+)'/gm)) assert.ok(m[1].startsWith('./'), `${file} imports ${m[1]}`)
  }
  const main = readFileSync(DELETION_FILES[0], 'utf8')
  assert.match(main, /assertServerOnly\(\)/)
  assert.match(main, /typeof window !== 'undefined'\) throw/)
  // nothing under components/ or any 'use client' file imports lib/deletion
  const clientFiles = SOURCES.filter((p) => /['"]use client['"]/.test(readFileSync(p, 'utf8').slice(0, 400)))
  assert.ok(clientFiles.length > 0, 'sanity: the app has client components')
  for (const p of clientFiles) assert.doesNotMatch(readFileSync(p, 'utf8'), /lib\/deletion/, `${p} imports lib/deletion`)
})
