// Run: node --experimental-strip-types --test supabase/functions/process-story/policy.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLAIMABLE_STATUSES,
  SWEEP_GRACE_MS,
  SWEEP_STALE_MS,
  isSweepEligible,
  isSweepStale,
  leaseIsFree,
  shouldSkipImages,
} from './policy.ts'

const NOW = Date.parse('2026-10-01T12:00:00Z')
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

test('beta mode is not an input to image skipping; images run when the operator flag is on', () => {
  assert.deepEqual(shouldSkipImages({ skipEnv: false, imageGenEnabled: true }), { skip: false, reason: null })
})

test('image_generation_enabled=false skips images with that reason', () => {
  assert.deepEqual(shouldSkipImages({ skipEnv: false, imageGenEnabled: false }), { skip: true, reason: 'image_generation_enabled=false' })
})

test('SKIP_IMAGE_GENERATION worker secret skips images', () => {
  assert.deepEqual(shouldSkipImages({ skipEnv: true, imageGenEnabled: true }), { skip: true, reason: 'SKIP_IMAGE_GENERATION=true' })
})

test('generating_text is claimable so a dead text worker can be reclaimed', () => {
  assert.ok(CLAIMABLE_STATUSES.includes('generating_text'))
  assert.ok(CLAIMABLE_STATUSES.includes('generating_images'))
  assert.ok(!CLAIMABLE_STATUSES.includes('complete'))
})

test('lease is free when no worker, when lease stamp missing, or when lease expired', () => {
  assert.equal(leaseIsFree({ worker_id: null, worker_lease_expires_at: null }, NOW), true)
  assert.equal(leaseIsFree({ worker_id: 'w1', worker_lease_expires_at: null }, NOW), true)
  assert.equal(leaseIsFree({ worker_id: 'w1', worker_lease_expires_at: iso(-1) }, NOW), true)
  assert.equal(leaseIsFree({ worker_id: 'w1', worker_lease_expires_at: iso(60_000) }, NOW), false)
})

test('sweep re-dispatches a released continuation row once the grace window has passed', () => {
  const released = { status: 'generating_images', worker_id: null, worker_lease_expires_at: null, updated_at: iso(-SWEEP_GRACE_MS - 1) }
  assert.equal(isSweepEligible(released, NOW), true)
})

test('sweep leaves a freshly released row alone (chained invocation is in flight)', () => {
  const fresh = { status: 'generating_images', worker_id: null, worker_lease_expires_at: null, updated_at: iso(-5_000) }
  assert.equal(isSweepEligible(fresh, NOW), false)
})

test('sweep never touches a row with a live lease', () => {
  const live = { status: 'generating_images', worker_id: 'w1', worker_lease_expires_at: iso(90_000), updated_at: iso(-10 * 60_000) }
  assert.equal(isSweepEligible(live, NOW), false)
})

test('sweep reclaims a row whose worker died (lease expired)', () => {
  const dead = { status: 'generating_text', worker_id: 'w1', worker_lease_expires_at: iso(-30_000), updated_at: iso(-3 * 60_000) }
  assert.equal(isSweepEligible(dead, NOW), true)
})

test('sweep ignores complete and failed rows', () => {
  for (const status of ['complete', 'failed', 'assembling_pdf']) {
    const row = { status, worker_id: null, worker_lease_expires_at: null, updated_at: iso(-60 * 60_000) }
    assert.equal(isSweepEligible(row, NOW), false)
    assert.equal(isSweepStale(row, NOW), false)
  }
})

test('sweep fails a row with no progress for the stale window, and not before', () => {
  const stale = { status: 'queued', worker_id: null, worker_lease_expires_at: null, updated_at: iso(-SWEEP_STALE_MS) }
  const recent = { status: 'queued', worker_id: null, worker_lease_expires_at: null, updated_at: iso(-SWEEP_STALE_MS + 1_000) }
  assert.equal(isSweepStale(stale, NOW), true)
  assert.equal(isSweepStale(recent, NOW), false)
  assert.equal(isSweepEligible(recent, NOW), true)
})
