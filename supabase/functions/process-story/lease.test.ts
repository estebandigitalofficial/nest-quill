// Lease guard unit tests (3C-7 worker lease safety hardening).
// Run: node --experimental-strip-types --test supabase/functions/process-story/lease.test.ts
//
// The guard is exercised against an in-memory story row whose worker_id
// and worker_lease_expires_at a second "worker" (or the clock) changes
// underneath the first. These tests prove the guard's contract;
// leaseSafety.test.ts proves index.ts uses it at every story write.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEASE_LOST_PREFIX, LeaseLostError, createLeaseGuard, isLeaseLost, leaseIsValid, memoryLeaseStore } from './lease.ts'

const NOW = Date.parse('2026-10-15T12:00:00Z')
const LEASE_MS = 120_000
const ME = 'worker-a'
const OTHER = 'worker-b'

/** A row claimed by `initialWorker` with a window that is open at NOW (or closed, when `expired`). */
function guardFor(initialWorker: string | null, opts: { expired?: boolean; workerId?: string; now?: () => number } = {}) {
  const workerId = opts.workerId ?? ME
  const expires = new Date(opts.expired ? NOW - 1 : NOW + LEASE_MS).toISOString()
  const mem = memoryLeaseStore({ worker_id: initialWorker, worker_lease_expires_at: expires, status: 'generating_images', progress_pct: 45 }, workerId)
  const guard = createLeaseGuard(mem.store, { workerId, leaseMs: LEASE_MS, now: opts.now ?? (() => NOW) })
  return { ...mem, guard }
}

test('1. the current worker with a valid lease writes: heartbeat, require, status all succeed and extend the window', async () => {
  const { guard, row, writes } = guardFor(ME)
  assert.equal(await guard.heartbeat(), true)
  assert.equal(row.worker_lease_expires_at, new Date(NOW + LEASE_MS).toISOString())
  assert.equal(row.worker_heartbeat_at, new Date(NOW).toISOString())
  assert.equal(await guard.stillOwns(), true)
  await guard.require('before saving the story')
  await guard.renewOrThrow('before writing the pages', 240_000)
  assert.equal(row.worker_lease_expires_at, new Date(NOW + 240_000).toISOString(), 'explicit window honoured')
  assert.deepEqual(await guard.setStatus('generating_images', 'Illustrating page 3 of 8…', 56), { error: null })
  assert.equal(row.status, 'generating_images')
  assert.equal(row.status_message, 'Illustrating page 3 of 8…')
  assert.equal(row.progress_pct, 56)
  assert.equal(writes.length, 4, 'heartbeat, require, renewOrThrow and setStatus each wrote once')
})

test('2. a stale worker (row reclaimed by another worker) cannot update story status', async () => {
  const { guard, row, writes } = guardFor(OTHER)
  await assert.rejects(() => guard.setStatus('generating_text', 'Writing…', 25), (e: unknown) => e instanceof LeaseLostError && isLeaseLost(e))
  assert.equal(row.status, 'generating_images', 'status untouched')
  assert.equal(row.progress_pct, 45, 'progress untouched')
  assert.equal(writes.length, 0, 'nothing written')
})

test('3. a stale worker cannot mark a story complete', async () => {
  const { guard, row, writes } = guardFor(OTHER)
  await assert.rejects(() => guard.setStatus('complete', 'Your story is ready!', 100, { completed_at: new Date(NOW).toISOString(), worker_id: null }), LeaseLostError)
  assert.equal(row.status, 'generating_images')
  assert.equal(row.completed_at, undefined)
  assert.equal(row.worker_id, OTHER, 'the live owner keeps its lease')
  assert.equal(writes.length, 0)
})

test('4. a stale worker cannot mark a story failed', async () => {
  const { guard, row, writes } = guardFor(OTHER)
  await assert.rejects(() => guard.setStatus('failed', 'Something went wrong', 45, { failure_code: 'UNKNOWN', retryable: true, worker_id: null }), LeaseLostError)
  assert.equal(row.status, 'generating_images')
  assert.equal(row.failure_code, undefined)
  assert.equal(row.worker_id, OTHER)
  assert.equal(writes.length, 0)
})

test('5. require() before a content write refuses a reclaimed row, and refuses it at every later checkpoint', async () => {
  const { guard, row } = guardFor(ME)
  await guard.require('before saving the story')
  row.worker_id = OTHER // reclaimed while a long call ran
  row.worker_lease_expires_at = new Date(NOW + LEASE_MS).toISOString()
  assert.equal(await guard.stillOwns(), false)
  await assert.rejects(() => guard.require('before saving the story'), (e: unknown) => e instanceof LeaseLostError && (e as LeaseLostError).where === 'before saving the story')
  await assert.rejects(() => guard.require('before page 4 scene write'), LeaseLostError)
  await assert.rejects(() => guard.require('before page 4 failure write'), LeaseLostError)
  await assert.rejects(() => guard.require('before recording the cover'), LeaseLostError)
  assert.equal(row.worker_id, OTHER, 'the reclaiming worker keeps the row')
})

test('6. a stale heartbeat writes nothing and renewOrThrow turns it into a lost lease', async () => {
  const { guard, row, writes } = guardFor(OTHER)
  const before = row.worker_lease_expires_at
  assert.equal(await guard.heartbeat(), false)
  assert.equal(row.worker_lease_expires_at, before, 'the other worker\'s window is not extended')
  assert.equal(writes.length, 0)
  await assert.rejects(() => guard.renewOrThrow('after page 2 image generation'), LeaseLostError)
})

test('7. a released row (worker_id null, legitimate continuation) is no longer ours either', async () => {
  const { guard, row } = guardFor(ME)
  row.worker_id = null // this invocation released at the time budget; the next one claims
  row.worker_lease_expires_at = null
  assert.equal(await guard.stillOwns(), false)
  assert.equal(await guard.heartbeat(), false)
  await assert.rejects(() => guard.setStatus('generating_images', 'late write', 70), LeaseLostError)
})

test('8. lease loss after a long-running operation is a LeaseLostError, distinct from a generation failure', async () => {
  const { guard, row } = guardFor(ME)
  // Simulate: renewed before the call, reclaimed during it, re-checked after.
  await guard.renewOrThrow('before page 1')
  row.worker_id = OTHER
  let caught: unknown
  try { await guard.renewOrThrow('after page 1 image generation') } catch (e) { caught = e }
  assert.ok(caught instanceof LeaseLostError)
  assert.equal((caught as LeaseLostError).where, 'after page 1 image generation')
  assert.ok((caught as Error).message.startsWith(LEASE_LOST_PREFIX))
  // Ordinary failures are never mistaken for a lost lease.
  assert.equal(isLeaseLost(new Error('rate limit exceeded')), false)
  assert.equal(isLeaseLost(new Error('Storage upload failed for page 1: timeout')), false)
  assert.equal(isLeaseLost(new Error('Image error 500: upstream')), false)
  assert.equal(isLeaseLost('OpenAI timeout'), false)
  assert.equal(isLeaseLost(null), false)
  // The message survives being re-thrown as a plain Error.
  assert.equal(isLeaseLost(new Error((caught as Error).message)), true)
})

test('9. a heartbeat that cannot be confirmed fails closed; a status statement error is reported, not thrown', async () => {
  const failing = {
    async updateOwned() { return { written: false, error: 'connection reset' } },
    async readOwnership() { return { workerId: ME, leaseExpiresAt: new Date(NOW + LEASE_MS).toISOString() } },
  }
  const guard = createLeaseGuard(failing, { workerId: ME, leaseMs: 1000, now: () => NOW })
  assert.equal(await guard.heartbeat(), false)
  await assert.rejects(() => guard.renewOrThrow('before page 5'), (e: unknown) => e instanceof LeaseLostError && /connection reset/.test((e as Error).message))
  assert.deepEqual(await guard.setStatus('generating_images', 'msg', 50), { error: 'connection reset' })
})

test('10. a missing row (deleted underneath the worker) reads as not owned', async () => {
  const gone = {
    async updateOwned() { return { written: false, error: null } },
    async readOwnership() { return { workerId: null, leaseExpiresAt: null } },
  }
  const guard = createLeaseGuard(gone, { workerId: ME, leaseMs: 1000 })
  assert.equal(await guard.stillOwns(), false)
  await assert.rejects(() => guard.require('before saving the story'), LeaseLostError)
  await assert.rejects(() => guard.setStatus('complete', 'done', 100), LeaseLostError)
})

// ── Lease expiry (PR #30 review, concern 1) ──────────────────────────────────

test('11. a worker whose window has closed cannot write, even though worker_id still matches', async () => {
  const { guard, row, writes } = guardFor(ME, { expired: true })
  assert.equal(row.worker_id, ME, 'precondition: still nominally ours')
  assert.equal(await guard.stillOwns(), false)
  await assert.rejects(() => guard.setStatus('generating_images', 'late write', 70), LeaseLostError)
  await assert.rejects(() => guard.setStatus('complete', 'Your story is ready!', 100), LeaseLostError)
  await assert.rejects(() => guard.setStatus('failed', 'boom', 70), LeaseLostError)
  await assert.rejects(() => guard.require('before saving the story'), LeaseLostError)
  assert.equal(row.status, 'generating_images')
  assert.equal(writes.length, 0)
})

test('12. an expired worker cannot silently renew its own window', async () => {
  const { guard, row, writes } = guardFor(ME, { expired: true })
  const closedAt = row.worker_lease_expires_at
  assert.equal(await guard.heartbeat(), false)
  assert.equal(row.worker_lease_expires_at, closedAt, 'window left closed')
  assert.equal(row.worker_heartbeat_at, undefined)
  assert.equal(writes.length, 0)
  await assert.rejects(() => guard.renewOrThrow('before page 3'), LeaseLostError)
  // The closed window is exactly what makes the row claimable by the next
  // invocation (claimableOrFilter in policy.ts); nothing here reopens it.
})

test('13. the window closes while a long call runs: the post-call checkpoint refuses the write', async () => {
  let t = NOW
  const { guard, row } = guardFor(ME, { now: () => t })
  await guard.renewOrThrow('before page 2') // window: NOW + 120 s
  t = NOW + LEASE_MS + 1 // the image call outlived the window
  await assert.rejects(() => guard.renewOrThrow('after page 2 image generation'), LeaseLostError)
  assert.equal(row.worker_lease_expires_at, new Date(NOW + LEASE_MS).toISOString(), 'not extended after the fact')
  await assert.rejects(() => guard.require('before page 2 scene write'), LeaseLostError)
})

test('14. a renewal inside the window keeps a legitimately progressing run alive', async () => {
  let t = NOW
  const { guard, row } = guardFor(ME, { now: () => t })
  for (let page = 1; page <= 4; page++) {
    await guard.renewOrThrow(`before page ${page}`)
    t += 30_000 // a 30 s image call, well inside the 120 s window
    await guard.renewOrThrow(`after page ${page} image generation`)
    await guard.require(`before page ${page} scene write`)
    assert.deepEqual(await guard.setStatus('generating_images', `Illustrating page ${page} of 4…`, 45 + page * 7), { error: null })
  }
  assert.equal(row.worker_lease_expires_at, new Date(t + LEASE_MS).toISOString())
  assert.equal(row.progress_pct, 73)
})

test('15. a reclaimed worker cannot overwrite the current worker\'s state, and the current worker is unaffected', async () => {
  // Shared row: worker A's window closed, worker B claimed it.
  const mem = memoryLeaseStore({ worker_id: ME, worker_lease_expires_at: new Date(NOW - 1).toISOString(), status: 'generating_images', progress_pct: 60 }, ME)
  const a = createLeaseGuard(mem.store, { workerId: ME, leaseMs: LEASE_MS, now: () => NOW })
  // B's claim (claimableOrFilter semantics: window closed → claimable).
  Object.assign(mem.row, { worker_id: OTHER, worker_lease_expires_at: new Date(NOW + LEASE_MS).toISOString(), status: 'generating_images', status_message: 'Resuming illustrations…' })
  const b = createLeaseGuard(memoryLeaseStore(mem.row as { worker_id: string | null }, OTHER).store, { workerId: OTHER, leaseMs: LEASE_MS, now: () => NOW })
  await assert.rejects(() => a.setStatus('generating_images', 'A is still here', 61), LeaseLostError)
  await assert.rejects(() => a.require('before page 5 scene write'), LeaseLostError)
  assert.equal(await a.heartbeat(), false)
  assert.equal(mem.row.status_message, 'Resuming illustrations…', 'B\'s state untouched by A')
  assert.equal(mem.row.worker_id, OTHER)
  assert.equal(await b.heartbeat(), true, 'B keeps working')
})

test('16. leaseIsValid: the pure rule behind every condition', () => {
  const open = new Date(NOW + 1).toISOString()
  const closed = new Date(NOW).toISOString()
  assert.equal(leaseIsValid({ workerId: ME, leaseExpiresAt: open }, ME, NOW), true)
  assert.equal(leaseIsValid({ workerId: ME, leaseExpiresAt: closed }, ME, NOW), false, 'expires_at == now is closed (strict >)')
  assert.equal(leaseIsValid({ workerId: OTHER, leaseExpiresAt: open }, ME, NOW), false)
  assert.equal(leaseIsValid({ workerId: ME, leaseExpiresAt: null }, ME, NOW), false, 'no stamp = no valid window')
  assert.equal(leaseIsValid({ workerId: null, leaseExpiresAt: null }, ME, NOW), false)
  assert.equal(leaseIsValid({ workerId: ME, leaseExpiresAt: 'not a date' }, ME, NOW), false)
})
