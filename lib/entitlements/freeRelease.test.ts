import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { freeReleaseDecision, releaseFreeReservationIfTerminal } from './freeRelease.ts'
import { reserveEntitlement, memoryEntitlementStore, emptyMemoryState } from './reserve.ts'

const FREE_SUB = { storyLength: 8, illustrationStyle: 'watercolor', dedicationText: null }

/** Tiny simulation of story_requests + release_free_reservation over the memory state. */
function simulate() {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 0 })
  const rows = new Map<string, Record<string, unknown>>()
  const db = {
    async rpc(_fn: 'release_free_reservation', args: { p_request_id: string }) {
      const r = rows.get(args.p_request_id)
      if (!r || r.entitlement_source !== 'free' || !r.user_id || r.status !== 'failed' || r.usage_counted === true || r.entitlement_released_at) return { data: false, error: null }
      r.entitlement_released_at = new Date().toISOString()
      const p = state.profiles.get(String(r.user_id))!; p.freeBooksUsed = Math.max(0, p.freeBooksUsed - 1)
      return { data: true, error: null }
    },
  }
  async function submit(id: string) {
    const r = await reserveEntitlement(store, { userId: 'u1', guestToken: null, email: null, intent: 'free', submission: FREE_SUB, limits: { freeLifetime: 2, freeGuest: 1 } })
    if (!r.ok) return false
    rows.set(id, { entitlement_source: r.reservation.decision.source, user_id: 'u1', status: 'queued', usage_counted: false, entitlement_released_at: null, failure_code: null, retryable: null, retry_count: 0 })
    return true
  }
  return { state, rows, db, submit }
}

test('Free success consumes one slot; a completed book never restores', async () => {
  const s = simulate()
  assert.ok(await s.submit('r1'))
  assert.equal(s.state.profiles.get('u1')!.freeBooksUsed, 1)
  const row = s.rows.get('r1')!
  row.status = 'complete'; row.usage_counted = true
  assert.equal(freeReleaseDecision(row).release, false)
  // even after an admin force requeue that then fails
  row.status = 'failed'; row.retryable = false
  assert.deepEqual(freeReleaseDecision(row), { release: false, reason: 'completed_before' })
  assert.equal(await releaseFreeReservationIfTerminal(s.db, 'r1', row), false)
  assert.equal(s.state.profiles.get('u1')!.freeBooksUsed, 1)
})

test('Free retry consumes no additional slot and does not release while still retryable', async () => {
  const s = simulate()
  assert.ok(await s.submit('r1'))
  const row = s.rows.get('r1')!
  row.status = 'failed'; row.failure_code = 'OPENAI_TIMEOUT'; row.retry_count = 1 // retryable, under the cap
  assert.deepEqual(freeReleaseDecision(row), { release: false, reason: 'still_retryable' })
  assert.equal(await releaseFreeReservationIfTerminal(s.db, 'r1', row), false)
  // the retry route re-queues the same row: nothing is reserved again
  row.status = 'queued'; row.retry_count = 2
  assert.equal(s.state.profiles.get('u1')!.freeBooksUsed, 1)
})

test('Free terminal technical failure restores exactly once; repeated handling never restores twice', async () => {
  const s = simulate()
  assert.ok(await s.submit('r1'))
  const row = s.rows.get('r1')!
  row.status = 'failed'; row.failure_code = 'OPENAI_ERROR'; row.retry_count = 3 // cap reached → terminal
  assert.deepEqual(freeReleaseDecision(row), { release: true })
  assert.equal(await releaseFreeReservationIfTerminal(s.db, 'r1', row), true)
  assert.equal(s.state.profiles.get('u1')!.freeBooksUsed, 0)
  // every later observer (status poll, admin action) is a no-op
  assert.equal(await releaseFreeReservationIfTerminal(s.db, 'r1', row), false)
  assert.deepEqual(freeReleaseDecision(row), { release: false, reason: 'already_released' })
  assert.equal(s.state.profiles.get('u1')!.freeBooksUsed, 0)
  // marked permanently failed by admin is terminal too
  const s2 = simulate(); await s2.submit('x'); const r2 = s2.rows.get('x')!
  r2.status = 'failed'; r2.retryable = false
  assert.equal(await releaseFreeReservationIfTerminal(s2.db, 'x', r2), true)
  // non-retryable failure code is terminal
  const s3 = simulate(); await s3.submit('y'); const r3 = s3.rows.get('y')!
  r3.status = 'failed'; r3.failure_code = 'INVALID_INPUT'
  assert.equal(freeReleaseDecision(r3).release, true)
})

test('paid Single and subscription terminal failures remain consumed', async () => {
  for (const source of ['purchase', 'subscription', 'admin'] as const) {
    const row = { entitlement_source: source, user_id: 'u1', status: 'failed', usage_counted: false, entitlement_released_at: null, failure_code: 'OPENAI_ERROR', retryable: false, retry_count: 5 }
    assert.deepEqual(freeReleaseDecision(row), { release: false, reason: 'not_free' })
  }
  // Guests have no counter to restore.
  assert.deepEqual(freeReleaseDecision({ entitlement_source: 'free', user_id: null, status: 'failed', retryable: false }), { release: false, reason: 'guest' })
  // The SQL function is free-only and once-only, and no paid release function is wired anywhere.
  const sql = readFileSync('supabase/migrations/20240068_entitlement_foundation.sql', 'utf8')
  const fn = sql.slice(sql.indexOf('FUNCTION public.release_free_reservation'), sql.indexOf('FUNCTION public.claim_guest_stories('))
  assert.match(fn, /entitlement_source = 'free'/)
  assert.match(fn, /usage_counted = false/)
  assert.match(fn, /entitlement_released_at IS NULL/)
  assert.match(fn, /user_id IS NOT NULL/)
  for (const f of ['app/api/story/status/route.ts', 'app/api/admin/stories/[requestId]/mark-failed/route.ts', 'app/api/admin/stories/[requestId]/cancel/route.ts', 'app/api/story/[requestId]/retry/route.ts', 'app/api/story/[requestId]/force-requeue/route.ts']) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /release_purchase|release_subscription_unit|releasePurchase|releasePeriodUnit/, f)
  }
  // The observers that can see a terminal failure call the Free-only helper.
  for (const f of ['app/api/story/status/route.ts', 'app/api/admin/stories/[requestId]/mark-failed/route.ts', 'app/api/admin/stories/[requestId]/cancel/route.ts']) {
    assert.match(readFileSync(f, 'utf8'), /releaseFreeReservationIfTerminal\(/, f)
  }
})

test('archive after completion does not touch the counter', () => {
  const archive = readFileSync('app/api/story/[requestId]/archive/route.ts', 'utf8')
  assert.doesNotMatch(archive, /free_books_used|release_free|entitlement/)
})
