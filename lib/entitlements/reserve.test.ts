import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reserveEntitlement, memoryEntitlementStore, emptyMemoryState, type ReserveContext } from './reserve.ts'

const LIMITS = { freeLifetime: 2, freeGuest: 1 }
const FREE_SUB = { storyLength: 8, illustrationStyle: 'watercolor', dedicationText: null }
const PAID_SUB = { storyLength: 32, illustrationStyle: 'cartoon', dedicationText: 'For Nana' }

function ctx(over: Partial<ReserveContext>): ReserveContext {
  return { userId: null, guestToken: null, email: null, intent: 'free', submission: FREE_SUB, limits: LIMITS, ...over }
}

/** Mirror what the DB function claim_guest_stories does, over the memory state. */
function claimGuest(state: ReturnType<typeof emptyMemoryState>, userId: string, token: string) {
  const mine = state.guestBooks.filter(b => b.token === token)
  const free = mine.filter(b => !b.failed).length
  const p = state.profiles.get(userId)!
  p.freeBooksUsed = Math.min(LIMITS.freeLifetime, p.freeBooksUsed + free)
  // ownership transfer: rows leave the guest pool
  state.guestBooks = state.guestBooks.filter(b => b.token !== token)
}

test('first guest Free story allowed; second refused', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  const first = await reserveEntitlement(store, ctx({ guestToken: 'g1', email: 'a@x.com' }))
  assert.ok(first.ok)
  if (first.ok) {
    assert.equal(first.reservation.decision.source, 'free')
    assert.equal(first.reservation.caps.pdfEntitled, false)
    state.guestBooks.push({ token: 'g1', email: 'a@x.com', failed: false }) // the row now exists
  }
  const second = await reserveEntitlement(store, ctx({ guestToken: 'g1', email: 'a@x.com' }))
  assert.equal(second.ok, false)
  if (!second.ok) assert.equal(second.denial.code, 'GUEST_LIMIT_EXCEEDED')
  // Same email from a fresh cookie is also refused.
  const sameEmail = await reserveEntitlement(store, ctx({ guestToken: 'g2', email: 'A@x.com' }))
  assert.equal(sameEmail.ok, false)
})

test('guest book counts toward the account lifetime allowance after claim: exactly one left', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  const g = await reserveEntitlement(store, ctx({ guestToken: 'g1', email: 'a@x.com' }))
  assert.ok(g.ok)
  state.guestBooks.push({ token: 'g1', email: 'a@x.com', failed: false })
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 0 })
  claimGuest(state, 'u1', 'g1')
  assert.equal(state.profiles.get('u1')!.freeBooksUsed, 1)
  const one = await reserveEntitlement(store, ctx({ userId: 'u1' }))
  assert.ok(one.ok)
  const two = await reserveEntitlement(store, ctx({ userId: 'u1' }))
  assert.equal(two.ok, false)
  if (!two.ok) assert.equal(two.denial.code, 'PLAN_LIMIT_EXCEEDED')
})

test('account with no guest history has two Free books and cannot exceed two', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 0 })
  assert.ok((await reserveEntitlement(store, ctx({ userId: 'u1' }))).ok)
  assert.ok((await reserveEntitlement(store, ctx({ userId: 'u1' }))).ok)
  const third = await reserveEntitlement(store, ctx({ userId: 'u1' }))
  assert.equal(third.ok, false)
  assert.equal(state.profiles.get('u1')!.freeBooksUsed, 2)
})

test('concurrent final-Free submissions produce exactly one winner', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 1 })
  const results = await Promise.all(Array.from({ length: 12 }, () => reserveEntitlement(store, ctx({ userId: 'u1' }))))
  assert.equal(results.filter(r => r.ok).length, 1)
  assert.equal(state.profiles.get('u1')!.freeBooksUsed, 2)
  // Concurrent guests on one token: one winner too.
  const guests = await Promise.all(Array.from({ length: 6 }, () => reserveEntitlement(store, ctx({ guestToken: 'g9', email: 'z@x.com' }))))
  assert.equal(guests.filter(r => r.ok).length, 1)
})

test('idempotent resubmission and recovery never reserve again (reservation is a submit-only step)', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 0 })
  const r = await reserveEntitlement(store, ctx({ userId: 'u1' }))
  assert.ok(r.ok)
  // The submit route short-circuits duplicates BEFORE reserveEntitlement is called,
  // and retry/force-requeue/backfill routes never import it at all:
  const { readFileSync } = await import('node:fs')
  for (const f of ['app/api/story/[requestId]/retry/route.ts', 'app/api/story/[requestId]/force-requeue/route.ts', 'app/api/admin/stories/[requestId]/generate-images/route.ts', 'app/api/cron/sweep-stories/route.ts']) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /reserveEntitlement|reserve_free_book|reserve_purchase|reserve_subscription_unit/, f)
  }
  const submit = readFileSync('app/api/story/submit/route.ts', 'utf8')
  assert.ok(submit.indexOf('reserveIdempotencyKey') < submit.indexOf('reserveEntitlement('), 'idempotency check runs before reservation')
  assert.equal(state.profiles.get('u1')!.freeBooksUsed, 1)
})

test('client tier manipulation cannot grant paid capabilities', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 0 })
  for (const intent of ['single', 'story_pack', 'story_pro'] as const) {
    const r = await reserveEntitlement(store, ctx({ userId: 'u1', intent, submission: PAID_SUB }))
    assert.equal(r.ok, false, intent)
    if (!r.ok) assert.equal(r.denial.code, 'ENTITLEMENT_REQUIRED')
  }
  // Guests cannot even ask.
  const g = await reserveEntitlement(store, ctx({ guestToken: 'g1', intent: 'story_pro', submission: PAID_SUB }))
  assert.equal(g.ok, false)
  if (!g.ok) assert.equal(g.denial.code, 'ACCOUNT_REQUIRED')
  // Free users asking for free with paid extras get free caps, not paid ones.
  const f = await reserveEntitlement(store, ctx({ userId: 'u1', intent: 'free', submission: { storyLength: 32, illustrationStyle: 'watercolor', dedicationText: 'x' } }))
  assert.ok(f.ok)
  if (f.ok) { assert.equal(f.reservation.caps.storyLength, 8); assert.equal(f.reservation.caps.dedicationText, null); assert.equal(f.reservation.caps.pdfEntitled, false) }
})

test('Single Story: a paid purchase is consumed exactly once and snapshots 16 pages', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 2 })
  state.purchases.set('p1', { userId: 'u1', tier: 'single', status: 'paid', requestId: null })
  const results = await Promise.all(Array.from({ length: 5 }, () => reserveEntitlement(store, ctx({ userId: 'u1', intent: 'single', submission: PAID_SUB }))))
  const winners = results.filter(r => r.ok)
  assert.equal(winners.length, 1)
  const w = winners[0]; assert.ok(w.ok)
  if (w.ok) {
    assert.equal(w.reservation.decision.source, 'purchase')
    assert.equal(w.reservation.decision.ref, 'p1')
    assert.equal(w.reservation.caps.storyLength, 16)
    assert.equal(w.reservation.caps.illustrationStyle, 'cartoon')
    assert.equal(w.reservation.caps.dedicationText, 'For Nana')
    assert.equal(w.reservation.caps.pdfEntitled, true)
    await w.reservation.attach('req-1')
  }
  assert.equal(state.purchases.get('p1')!.status, 'consumed')
  assert.equal(state.purchases.get('p1')!.requestId, 'req-1')
  // Another purchase of a different tier does not satisfy a 'single' intent.
  state.purchases.set('p2', { userId: 'u1', tier: 'story_pro', status: 'paid', requestId: null })
  const again = await reserveEntitlement(store, ctx({ userId: 'u1', intent: 'single', submission: PAID_SUB }))
  assert.equal(again.ok, false)
})

test('failed paid requests are not automatically restored; undo only compensates a missing row', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 2 })
  state.purchases.set('p1', { userId: 'u1', tier: 'single', status: 'paid', requestId: null })
  const r = await reserveEntitlement(store, ctx({ userId: 'u1', intent: 'single', submission: PAID_SUB }))
  assert.ok(r.ok)
  if (r.ok) await r.reservation.attach('req-1')
  // A story that later fails keeps its purchase: release is a no-op once attached.
  await store.releasePurchase('p1')
  assert.equal(state.purchases.get('p1')!.status, 'consumed')
  assert.equal(state.purchases.get('p1')!.requestId, 'req-1')
  // Compensation path: reserved but the row insert failed → the unit goes back.
  state.purchases.set('p2', { userId: 'u1', tier: 'single', status: 'paid', requestId: null })
  const r2 = await reserveEntitlement(store, ctx({ userId: 'u1', intent: 'single', submission: PAID_SUB }))
  assert.ok(r2.ok)
  if (r2.ok) await r2.reservation.undo()
  assert.equal(state.purchases.get('p2')!.status, 'paid')
  // Nothing in the codebase releases on failure automatically.
  const { readFileSync } = await import('node:fs')
  for (const f of ['app/api/story/status/route.ts', 'app/api/story/[requestId]/retry/route.ts', 'app/api/admin/stories/[requestId]/mark-failed/route.ts', 'app/api/admin/stories/[requestId]/cancel/route.ts']) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /release_purchase|release_subscription_unit|release_free_book|releasePurchase|releasePeriodUnit/, f)
  }
})

test('Story Pack: allowance 3 per period, 24 pages, one winner for the last unit', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 2 })
  state.periods.set('per1', { userId: 'u1', planTier: 'story_pack', allowance: 3, used: 0, start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' })
  const now = '2026-10-15T00:00:00Z'
  for (let i = 0; i < 3; i++) {
    const r = await reserveEntitlement(store, ctx({ userId: 'u1', intent: 'story_pack', submission: PAID_SUB, nowIso: now }))
    assert.ok(r.ok, `book ${i + 1}`)
    if (r.ok) { assert.equal(r.reservation.caps.storyLength, 24); assert.equal(r.reservation.decision.source, 'subscription') }
  }
  const fourth = await reserveEntitlement(store, ctx({ userId: 'u1', intent: 'story_pack', submission: PAID_SUB, nowIso: now }))
  assert.equal(fourth.ok, false)
  assert.equal(state.periods.get('per1')!.used, 3)
  // Outside the period window nothing is available (no rollover, no carry).
  const later = await reserveEntitlement(store, ctx({ userId: 'u1', intent: 'story_pack', submission: PAID_SUB, nowIso: '2026-11-02T00:00:00Z' }))
  assert.equal(later.ok, false)
})

test('Story Pro: allowance 6 per period, 32 pages; concurrent burst yields exactly six', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 0 })
  state.periods.set('per1', { userId: 'u1', planTier: 'story_pro', allowance: 6, used: 0, start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' })
  const results = await Promise.all(Array.from({ length: 20 }, () => reserveEntitlement(store, ctx({ userId: 'u1', intent: 'story_pro', submission: PAID_SUB, nowIso: '2026-10-15T00:00:00Z' }))))
  const ok = results.filter(r => r.ok)
  assert.equal(ok.length, 6)
  for (const r of ok) if (r.ok) assert.equal(r.reservation.caps.storyLength, 32)
  assert.equal(state.periods.get('per1')!.used, 6)
})

test('subscription period tier wins over a different client intent', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 0 })
  state.periods.set('per1', { userId: 'u1', planTier: 'story_pack', allowance: 3, used: 0, start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' })
  const r = await reserveEntitlement(store, ctx({ userId: 'u1', intent: 'story_pro', submission: PAID_SUB, nowIso: '2026-10-15T00:00:00Z' }))
  assert.ok(r.ok)
  if (r.ok) { assert.equal(r.reservation.decision.tier, 'story_pack'); assert.equal(r.reservation.caps.storyLength, 24) }
})

test('historical labels and legacy counters grant nothing; admins resolve without reserving', async () => {
  const state = emptyMemoryState(); const store = memoryEntitlementStore(state)
  // A legacy "story_pro" profile label is not an input to the resolver at all.
  state.profiles.set('u1', { isAdmin: false, freeBooksUsed: 0 })
  const r = await reserveEntitlement(store, ctx({ userId: 'u1', intent: 'story_pro', submission: PAID_SUB }))
  assert.equal(r.ok, false)
  state.profiles.set('adm', { isAdmin: true, freeBooksUsed: 99 })
  const a = await reserveEntitlement(store, ctx({ userId: 'adm', intent: 'story_pro', submission: PAID_SUB }))
  assert.ok(a.ok)
  if (a.ok) { assert.equal(a.reservation.decision.source, 'admin'); assert.equal(a.reservation.caps.storyLength, 32) }
  assert.equal(state.profiles.get('adm')!.freeBooksUsed, 99)
})

test('existing legacy stories remain readable: the reader route never consults entitlement', async () => {
  const { readFileSync } = await import('node:fs')
  const reader = readFileSync('app/api/story/[requestId]/route.ts', 'utf8')
  assert.doesNotMatch(reader, /entitlement|pdf_entitled|reserveEntitlement/)
  assert.match(reader, /storyReq\.status === 'complete'/)
})
