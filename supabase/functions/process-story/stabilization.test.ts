// Phase 1G pre-deployment stabilization — focused Node tests.
// Run: node --experimental-strip-types --test supabase/functions/process-story/stabilization.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BACKFILL_LEASE_MS,
  DISPATCH_WAIT_MS,
  HARD_LIMIT_MS,
  READY_EMAIL_MAX_FAILED,
  TIME_BUDGET_MS,
  claimableOrFilter,
  coverStartAllowed,
  isAuthorizedBearer,
  isSweepEligible,
  leaseIsFree,
  monotonicProgress,
  ownsLease,
  raceDispatch,
  readyEmailRecoveryCandidates,
} from './policy.ts'
import { buildCoverPrompt, buildImagePrompt, buildVisualBible } from './visual.ts'

const ROOT = resolve(import.meta.dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')
const NOW = Date.parse('2026-10-01T12:00:00Z')
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

// ── AUTH ────────────────────────────────────────────────────────────────────

test('AUTH 1. process-story gateway config matches the function\'s own bearer gate', () => {
  const toml = read('supabase/config.toml')
  const block = /\[functions\.process-story\]\s*\n\s*verify_jwt\s*=\s*false/m
  assert.match(toml, block, 'config.toml must declare [functions.process-story] verify_jwt = false')
  const index = read('supabase/functions/process-story/index.ts')
  const authAt = index.indexOf("isAuthorizedBearer(req.headers.get('Authorization'), EXPECTED_TOKEN)")
  const parseAt = index.indexOf('await req.json()')
  assert.ok(authAt > 0, 'function must gate on isAuthorizedBearer')
  assert.ok(authAt < parseAt, 'bearer gate must run before the body (mode) is parsed')
  assert.doesNotMatch(index, /EDGE_FUNCTION_SECRET\s*=\s*['"]/, 'no hard-coded secret')
})

test('AUTH 2. sweep callers send the expected bearer header from the expected secret source', () => {
  const sql = read('supabase/migrations/20240062_process_story_sweep_cron.sql')
  assert.match(sql, /'Authorization',\s*'Bearer ' \|\| \(\s*SELECT decrypted_secret FROM vault\.decrypted_secrets\s*WHERE name = 'process_story_sweep_token'/)
  assert.match(sql, /RAISE EXCEPTION 'Vault secret process_story_sweep_token is missing/)
  assert.match(sql, /https:\/\/pejzpbyqaiajntndgavz\.supabase\.co\/functions\/v1\/process-story/)
  assert.match(sql, /'\{"mode":"sweep"\}'::jsonb/)
  assert.equal((sql.match(/cron\.schedule\(/g) ?? []).length, 1)
  assert.match(sql, /cron\.unschedule\('process-story-sweep'\)/, 're-running must not duplicate the job')
  const route = read('app/api/cron/sweep-stories/route.ts')
  assert.match(route, /Authorization: `Bearer \$\{process\.env\.EDGE_FUNCTION_SECRET \?\? process\.env\.SUPABASE_SERVICE_ROLE_KEY\}`/)
  assert.match(route, /mode: 'sweep'/)
})

test('AUTH 3. privileged modes reject an invalid, missing, malformed or empty bearer', () => {
  const secret = 'shared-secret-value'
  assert.equal(isAuthorizedBearer(`Bearer ${secret}`, secret), true)
  assert.equal(isAuthorizedBearer(`bearer ${secret}`, secret), true)
  assert.equal(isAuthorizedBearer(`Bearer ${secret}x`, secret), false)
  assert.equal(isAuthorizedBearer(`Bearer ${secret.slice(0, -1)}`, secret), false)
  assert.equal(isAuthorizedBearer('Bearer ', secret), false)
  assert.equal(isAuthorizedBearer(secret, secret), false)
  assert.equal(isAuthorizedBearer(null, secret), false)
  assert.equal(isAuthorizedBearer(`Bearer ${secret}`, ''), false)
  assert.equal(isAuthorizedBearer(`Bearer ${secret}`, undefined), false)
  assert.equal(isAuthorizedBearer('Bearer undefined', undefined), false)
})

// ── DISPATCH ────────────────────────────────────────────────────────────────

function controlled() {
  let resolveSleep!: () => void
  const sleeps: Array<{ ms: number; release: () => void }> = []
  const sleepFn = (ms: number) => new Promise<void>(r => { resolveSleep = r; sleeps.push({ ms, release: r }) })
  return { sleepFn, sleeps, release: () => resolveSleep() }
}

test('DISPATCH 9. dispatch waits only for the bounded attempt: accepted, rejected, error, timeout', async () => {
  assert.equal(DISPATCH_WAIT_MS, 3_000)
  // accepted
  let c = controlled()
  let r = await raceDispatch(Promise.resolve({ ok: true, status: 200 }), DISPATCH_WAIT_MS, c.sleepFn)
  assert.deepEqual(r, { ok: true, outcome: 'accepted', status: 200 })
  assert.equal(c.sleeps[0].ms, DISPATCH_WAIT_MS)
  // rejected
  c = controlled()
  r = await raceDispatch(Promise.resolve({ ok: false, status: 401 }), DISPATCH_WAIT_MS, c.sleepFn)
  assert.deepEqual(r, { ok: false, outcome: 'rejected', status: 401 })
  // error
  c = controlled()
  r = await raceDispatch(Promise.reject(new Error('connect refused')), DISPATCH_WAIT_MS, c.sleepFn)
  assert.deepEqual(r, { ok: false, outcome: 'error', error: 'connect refused' })
  // timeout: the child never answers; the parent still returns when the wait elapses
  c = controlled()
  const never = new Promise<{ ok: boolean; status: number }>(() => {})
  const pending = raceDispatch(never, DISPATCH_WAIT_MS, c.sleepFn)
  let settled = false
  pending.then(() => { settled = true })
  await Promise.resolve()
  assert.equal(settled, false, 'must not settle before the wait elapses')
  c.release()
  r = await pending
  assert.deepEqual(r, { ok: true, outcome: 'timeout', status: 0 })
})

test('DISPATCH 10. a timed-out or failed dispatch leaves a released row the sweep will pick up', () => {
  const released = { status: 'generating_images', worker_id: null, worker_lease_expires_at: null, updated_at: iso(-60_000) }
  assert.equal(isSweepEligible(released, NOW), true)
  const justReleased = { ...released, updated_at: iso(-10_000) }
  assert.equal(isSweepEligible(justReleased, NOW), false, 'grace window protects an in-flight child')
})

// ── BACKFILL LEASE (in-memory model of the story_requests predicate) ────────

interface Row { status: string; worker_id: string | null; worker_lease_expires_at: string | null }

function claimBackfill(row: Row, workerId: string, nowMs: number): boolean {
  if (row.status !== 'complete') return false
  if (!leaseIsFree(row, nowMs)) return false
  row.worker_id = workerId
  row.worker_lease_expires_at = new Date(nowMs + BACKFILL_LEASE_MS).toISOString()
  return true
}
function releaseBackfill(row: Row, workerId: string): boolean {
  if (!ownsLease(row, workerId)) return false
  row.worker_id = null
  row.worker_lease_expires_at = null
  return true
}

test('BACKFILL 11. backfill receives a real lease stamp', () => {
  const row: Row = { status: 'complete', worker_id: null, worker_lease_expires_at: null }
  assert.equal(claimBackfill(row, 'b1', NOW), true)
  assert.equal(row.worker_id, 'b1')
  assert.equal(row.worker_lease_expires_at, iso(BACKFILL_LEASE_MS))
  assert.equal(BACKFILL_LEASE_MS, 120_000)
})

test('BACKFILL 12. another backfill cannot claim a live lease', () => {
  const row: Row = { status: 'complete', worker_id: null, worker_lease_expires_at: null }
  assert.equal(claimBackfill(row, 'b1', NOW), true)
  assert.equal(claimBackfill(row, 'b2', NOW + 30_000), false)
  assert.equal(row.worker_id, 'b1')
})

test('BACKFILL 13. an expired (crashed) backfill lease is reclaimable without manual SQL', () => {
  const row: Row = { status: 'complete', worker_id: 'crashed', worker_lease_expires_at: iso(-1) }
  assert.equal(claimBackfill(row, 'b2', NOW), true)
  assert.equal(row.worker_id, 'b2')
  // a legacy row with worker_id but no lease stamp (pre-fix crash) is also reclaimable
  const legacy: Row = { status: 'complete', worker_id: 'old', worker_lease_expires_at: null }
  assert.equal(claimBackfill(legacy, 'b3', NOW), true)
})

test('BACKFILL 14. finally-style cleanup releases the owner on completion and on error', async () => {
  for (const fail of [false, true]) {
    const row: Row = { status: 'complete', worker_id: null, worker_lease_expires_at: null }
    assert.equal(claimBackfill(row, 'b1', NOW), true)
    let released = false
    try {
      if (fail) throw new Error('DALL-E down')
    } catch { /* logged by the function */ } finally {
      released = releaseBackfill(row, 'b1')
    }
    assert.equal(released, true)
    assert.equal(row.worker_id, null)
    assert.equal(row.worker_lease_expires_at, null)
  }
})

test('BACKFILL 15. a stale owner cannot clear a newer owner\'s lock', () => {
  const row: Row = { status: 'complete', worker_id: 'b1', worker_lease_expires_at: iso(-1) }
  assert.equal(claimBackfill(row, 'b2', NOW), true)
  assert.equal(releaseBackfill(row, 'b1'), false)
  assert.equal(row.worker_id, 'b2')
  assert.equal(releaseBackfill(row, 'b2'), true)
})

// ── COVER OWNERSHIP ─────────────────────────────────────────────────────────

test('COVER 16. a stale story worker cannot overwrite a newer worker\'s cover state', () => {
  const row: Row = { status: 'generating_images', worker_id: 'w1', worker_lease_expires_at: iso(-1) }
  const cover = { cover_status: 'generating', writer: 'w1' }
  // w2 reclaims the expired lease
  row.worker_id = 'w2'
  row.worker_lease_expires_at = iso(120_000)
  const write = (workerId: string, status: string) => {
    if (!ownsLease(row, workerId)) return false
    cover.cover_status = status; cover.writer = workerId; return true
  }
  assert.equal(write('w2', 'complete'), true)
  assert.equal(write('w1', 'failed'), false, 'stale worker refused')
  assert.deepEqual(cover, { cover_status: 'complete', writer: 'w2' })
})

// ── PRIVACY ─────────────────────────────────────────────────────────────────

test('PRIVACY 17. page and cover prompt metadata carry no supporting-character names', () => {
  const bible = buildVisualBible({
    requestId: 'req-privacy',
    childName: 'Sofia',
    childAge: 6,
    childDescription: 'curly brown hair, green glasses',
    supportingCharactersText: 'Mateo (little brother), Grandma Rosa (grandmother)',
    illustrationStyle: 'watercolor',
    styleHint: 'soft watercolor',
    plan: null,
    consistencyRules: null,
  })
  const page = buildImagePrompt({ bible, pageNumber: 2, imageDescription: 'Sofia and Mateo wave to Grandma Rosa.', planPage: null, safetySuffix: 'safe' })
  const cover = buildCoverPrompt({ bible, plan: null, tones: ['warm'], bandImageHint: '', safetySuffix: 'safe' })
  const flat = JSON.stringify([page.meta, cover.meta])
  for (const name of ['Mateo', 'Rosa', 'Grandma', 'Sofia']) assert.ok(!flat.includes(name), `${name} leaked into log metadata`)
  assert.equal(typeof page.meta.supporting_present_count, 'number')
  assert.equal(typeof cover.meta.supporting_present_count, 'number')
  assert.ok(page.meta.supporting_present_count >= 1)
})

// ── BUDGET / PROGRESS / RECOVERY ────────────────────────────────────────────

test('M5. cover start is refused when the measured image time projects past the hard limit', () => {
  assert.equal(HARD_LIMIT_MS, 150_000)
  assert.equal(TIME_BUDGET_MS, 110_000)
  assert.equal(coverStartAllowed(60_000, 20_000).allowed, true)
  assert.equal(coverStartAllowed(109_000, null).reason, 'ok')
  assert.equal(coverStartAllowed(110_000, null).reason, 'budget')
  assert.equal(coverStartAllowed(100_000, 48_000).reason, 'projected_overrun')
  assert.equal(coverStartAllowed(100_000, 40_000).allowed, true)
})

test('progress never moves backwards on a resumed claim', () => {
  assert.equal(monotonicProgress(25, 10), 25)
  assert.equal(monotonicProgress(null, 10), 10)
  assert.equal(monotonicProgress(60, 45), 60)
  assert.equal(monotonicProgress(30, 45), 45)
})

test('M1. ready-email recovery picks complete stories without a successful send, bounded and graceful', () => {
  const rows = [
    { id: 'a', completed_at: iso(-10 * 60_000), user_email: 'a@x' },     // no logs → candidate
    { id: 'b', completed_at: iso(-10 * 60_000), user_email: 'b@x' },     // sent → skip
    { id: 'c', completed_at: iso(-30_000), user_email: 'c@x' },          // inside grace → skip
    { id: 'd', completed_at: iso(-10 * 60_000), user_email: null },      // no email → skip
    { id: 'e', completed_at: iso(-10 * 60_000), user_email: 'e@x' },     // failed 3× → skip
    { id: 'f', completed_at: iso(-10 * 60_000), user_email: 'f@x' },     // failed 1× → candidate
    { id: 'g', completed_at: iso(-10 * 60_000), user_email: 'g@x' },     // only admin email sent → candidate
    { id: 'h', completed_at: iso(-25 * 60 * 60_000), user_email: 'h@x' }, // outside window → skip
  ]
  const logs = [
    { request_id: 'b', channel: 'email', status: 'sent', email_type: null },
    ...Array.from({ length: READY_EMAIL_MAX_FAILED }, () => ({ request_id: 'e', channel: 'email', status: 'failed', email_type: null })),
    { request_id: 'f', channel: 'email', status: 'failed', email_type: null },
    { request_id: 'g', channel: 'email', status: 'sent', email_type: 'admin_story_completed' },
  ]
  assert.deepEqual(readyEmailRecoveryCandidates(rows, logs, NOW), ['a', 'f', 'g'])
})

// ── LEGACY LOCK COMPATIBILITY ───────────────────────────────────────────────

/** Evaluate the PostgREST or-filter the way PostgREST does, clause by clause. */
function matchesClaimFilter(filter: string, row: Row, nowIso: string): boolean {
  return filter.split(',').some(clause => {
    if (clause === 'worker_id.is.null') return row.worker_id === null
    if (clause === 'worker_lease_expires_at.is.null') return row.worker_lease_expires_at === null
    if (clause.startsWith('worker_lease_expires_at.lt.')) {
      const bound = clause.slice('worker_lease_expires_at.lt.'.length)
      return row.worker_lease_expires_at !== null && row.worker_lease_expires_at < bound
    }
    throw new Error(`unexpected clause ${clause}`)
  })
}

test('LEGACY 1-4,7. the SQL claim filter agrees with leaseIsFree for every ownership state', () => {
  const nowIso = iso(0)
  const filter = claimableOrFilter(nowIso)
  assert.equal(filter, `worker_id.is.null,worker_lease_expires_at.is.null,worker_lease_expires_at.lt.${nowIso}`)
  const cases: Array<[Row, boolean, string]> = [
    [{ status: 'complete', worker_id: null, worker_lease_expires_at: null }, true, '1. no worker'],
    [{ status: 'complete', worker_id: 'w1', worker_lease_expires_at: iso(60_000) }, false, '2. live lease'],
    [{ status: 'complete', worker_id: 'w1', worker_lease_expires_at: iso(-1) }, true, '3. expired lease'],
    [{ status: 'complete', worker_id: 'legacy', worker_lease_expires_at: null }, true, '4. legacy worker with no lease stamp'],
    [{ status: 'generating_images', worker_id: 'w1', worker_lease_expires_at: iso(120_000) }, false, '7. modern live pipeline lease'],
    [{ status: 'generating_images', worker_id: 'w1', worker_lease_expires_at: iso(-120_000) }, true, '7. modern expired pipeline lease'],
  ]
  for (const [row, expected, label] of cases) {
    assert.equal(matchesClaimFilter(filter, row, nowIso), expected, `filter: ${label}`)
    assert.equal(leaseIsFree(row, NOW), expected, `policy: ${label}`)
  }
  const index = read('supabase/functions/process-story/index.ts')
  assert.equal((index.match(/\.or\(claimableOrFilter\(/g) ?? []).length, 2, 'pipeline claim and backfill claim use the shared filter')
  assert.ok(!/worker_lease_expires_at\.lt\.\$\{/.test(index), 'no hand-written lease predicate remains')
})

test('LEGACY 5-6. with the compatible filter, concurrency and stale-owner protection are unchanged', () => {
  const nowIso = iso(0)
  const filter = claimableOrFilter(nowIso)
  // legacy row: first backfill claims and stamps a lease; a concurrent second cannot
  const row: Row = { status: 'complete', worker_id: 'legacy', worker_lease_expires_at: null }
  assert.equal(matchesClaimFilter(filter, row, nowIso), true)
  row.worker_id = 'b1'; row.worker_lease_expires_at = iso(BACKFILL_LEASE_MS)
  assert.equal(matchesClaimFilter(filter, row, nowIso), false, '6. second concurrent backfill refused')
  // stale owner cannot release the newer owner
  assert.equal(ownsLease(row, 'legacy'), false)
  assert.equal(ownsLease(row, 'b1'), true)
})
