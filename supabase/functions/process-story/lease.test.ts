// Lease guard unit tests (3C-7 worker lease safety hardening).
// Run: node --experimental-strip-types --test supabase/functions/process-story/lease.test.ts
//
// The guard is exercised against an in-memory story row whose worker_id a
// second "worker" changes underneath the first. These tests prove the
// guard's contract; leaseSafety.test.ts proves index.ts uses it at every
// story write.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEASE_LOST_PREFIX, LeaseLostError, createLeaseGuard, isLeaseLost, memoryLeaseStore } from './lease.ts'

const NOW = Date.parse('2026-10-15T12:00:00Z')
const ME = 'worker-a'
const OTHER = 'worker-b'

function guardFor(initialWorker: string | null, workerId = ME) {
  const mem = memoryLeaseStore({ worker_id: initialWorker, status: 'generating_images', progress_pct: 45 }, workerId)
  const guard = createLeaseGuard(mem.store, { workerId, leaseMs: 120_000, now: () => NOW })
  return { ...mem, guard }
}

test('1. the current owner updates its own story: heartbeat, status and ownership all succeed', async () => {
  const { guard, row, writes } = guardFor(ME)
  assert.equal(await guard.heartbeat(), true)
  assert.equal(row.worker_lease_expires_at, new Date(NOW + 120_000).toISOString())
  assert.equal(row.worker_heartbeat_at, new Date(NOW).toISOString())
  assert.equal(await guard.stillOwns(), true)
  await guard.require('checkpoint')
  await guard.renewOrThrow('checkpoint', 240_000)
  assert.equal(row.worker_lease_expires_at, new Date(NOW + 240_000).toISOString())
  assert.deepEqual(await guard.setStatus('generating_images', 'Illustrating page 3 of 8…', 56), { error: null })
  assert.equal(row.status, 'generating_images')
  assert.equal(row.status_message, 'Illustrating page 3 of 8…')
  assert.equal(row.progress_pct, 56)
  assert.equal(writes.length, 3)
})

test('2. a stale worker cannot update story status', async () => {
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

test('5. ownership checks before content writes: stillOwns/require refuse a reclaimed row', async () => {
  const { guard, row } = guardFor(ME)
  await guard.require('before saving the story')
  row.worker_id = OTHER // reclaimed while a long call ran
  assert.equal(await guard.stillOwns(), false)
  await assert.rejects(() => guard.require('before saving the story'), (e: unknown) => e instanceof LeaseLostError && (e as LeaseLostError).where === 'before saving the story')
  await assert.rejects(() => guard.require('before page 4 scene write'), LeaseLostError)
  await assert.rejects(() => guard.require('before recording the cover'), LeaseLostError)
})

test('6. a stale heartbeat writes nothing and renewOrThrow turns it into a lost lease', async () => {
  const { guard, row, writes } = guardFor(OTHER)
  assert.equal(await guard.heartbeat(), false)
  assert.equal(row.worker_lease_expires_at, undefined, 'the other worker\'s lease is not extended')
  assert.equal(writes.length, 0)
  await assert.rejects(() => guard.renewOrThrow('after page 2 image generation'), LeaseLostError)
})

test('7. a released row (worker_id null, legitimate continuation) is no longer ours either', async () => {
  const { guard, row } = guardFor(ME)
  row.worker_id = null // this invocation released at the time budget; the next one claims
  assert.equal(await guard.stillOwns(), false)
  assert.equal(await guard.heartbeat(), false)
  await assert.rejects(() => guard.setStatus('generating_images', 'late write', 70), LeaseLostError)
})

test('8. lease loss after a long-running operation is a LeaseLostError, distinct from a generation failure', async () => {
  const { guard, row } = guardFor(ME)
  // Simulate: checked before the call, reclaimed during it, re-checked after.
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
  assert.equal(isLeaseLost('OpenAI timeout'), false)
  assert.equal(isLeaseLost(null), false)
  // The message survives being re-thrown as a plain Error.
  assert.equal(isLeaseLost(new Error((caught as Error).message)), true)
})

test('9. a heartbeat that cannot be confirmed fails closed; a status statement error is reported, not thrown', async () => {
  const failing = {
    async updateOwned() { return { written: false, error: 'connection reset' } },
    async readWorkerId() { return ME },
  }
  const guard = createLeaseGuard(failing, { workerId: ME, leaseMs: 1000, now: () => NOW })
  assert.equal(await guard.heartbeat(), false)
  await assert.rejects(() => guard.renewOrThrow('before page 5'), (e: unknown) => e instanceof LeaseLostError && /connection reset/.test((e as Error).message))
  assert.deepEqual(await guard.setStatus('generating_images', 'msg', 50), { error: 'connection reset' })
})

test('10. a missing row (deleted underneath the worker) reads as not owned', async () => {
  const gone = {
    async updateOwned() { return { written: false, error: null } },
    async readWorkerId() { return null },
  }
  const guard = createLeaseGuard(gone, { workerId: ME, leaseMs: 1000 })
  assert.equal(await guard.stillOwns(), false)
  await assert.rejects(() => guard.require('before saving the story'), LeaseLostError)
  await assert.rejects(() => guard.setStatus('complete', 'done', 100), LeaseLostError)
})
