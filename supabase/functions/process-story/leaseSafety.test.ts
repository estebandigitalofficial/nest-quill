// Worker lease-safety source contracts (3C-7).
// Run: node --experimental-strip-types --test supabase/functions/process-story/leaseSafety.test.ts
//
// index.ts runs only under Deno with a live Supabase client, so these
// tests pin the SHAPE of the worker source: every story write is either
// conditioned on worker_id or immediately preceded by a lease check, and a
// lost lease is routed away from the failure path. lease.test.ts proves the
// guard's behaviour; together they cover what an integration run would.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CLAIMABLE_STATUSES, claimableOrFilter, isSweepEligible, leaseIsFree } from './policy.ts'

const INDEX = readFileSync(resolve(import.meta.dirname, 'index.ts'), 'utf8')

/** Source between two unique markers (first occurrence of each). */
function between(startMarker: string, endMarker: string, from = 0): string {
  const a = INDEX.indexOf(startMarker, from)
  assert.ok(a >= 0, `marker not found: ${startMarker}`)
  const b = INDEX.indexOf(endMarker, a + startMarker.length)
  assert.ok(b >= 0, `marker not found: ${endMarker}`)
  return INDEX.slice(a, b)
}

const PIPELINE = between("// ── Pipeline ───", '} catch (err) {')
const CATCH = between('} catch (err) {', '\n})')
const COVER = between('async function runCoverStage(', '// ── Quiz generator')
const BACKFILL = between('// ── Images-only backfill', '// ── End images-only backfill')
const MOCK = between('if (MOCK_PIPELINE) {', '// ── Step 1: Story text')

test('S1. the pipeline builds one lease guard bound to its own worker id and routes status writes through it', () => {
  assert.match(INDEX, /const lease = createLeaseGuard\(supabaseLeaseStore\(supabase, requestId, workerId\), \{ workerId, leaseMs: LEASE_MS \}\)/)
  const store = between('function supabaseLeaseStore(', '\n}\n')
  assert.match(store, /\.update\(values\)\s*\.eq\('id', requestId\)\s*\.eq\('worker_id', workerId\)\s*\.gt\('worker_lease_expires_at', nowIso\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/, 'owned writes require worker_id AND an open window in one statement')
  const setStatus = between('async function setStatus(', '\n  }\n', INDEX.indexOf('// ── Helpers'))
  assert.match(setStatus, /await lease\.setStatus\(status, message, progress, extra\)/)
  assert.doesNotMatch(setStatus, /\.from\('story_requests'\)/, 'setStatus must not issue its own unconditioned UPDATE')
})

test('S2. no unconditioned story_requests UPDATE remains in the pipeline, the catch block, the cover stage or the mock path', () => {
  // Every `.from('story_requests').update(` in these regions must be followed
  // (within the same statement) by a worker_id condition.
  for (const [name, src, workerVar] of [['pipeline', PIPELINE, 'workerId'], ['catch', CATCH, 'workerId'], ['mock', MOCK, 'workerId'], ['backfill', BACKFILL, 'lockId']] as const) {
    const re = /\.from\('story_requests'\)\s*\.update\(/g
    let m: RegExpExecArray | null
    let count = 0
    while ((m = re.exec(src)) !== null) {
      count++
      const stmt = src.slice(m.index, src.indexOf('\n\n', m.index) === -1 ? undefined : src.indexOf('\n\n', m.index))
      // One deliberate exception: the usage_counted flip runs only after the
      // owner-only completion UPDATE succeeded (which released worker_id), so
      // it cannot carry a worker_id condition. It is idempotent by its own
      // `usage_counted = false` guard, shared with status/route.ts.
      // The backfill's own claim is a lease-aware claim, not an owned write:
      // it is what assigns lockId, so it is guarded by claimableOrFilter.
      if (/\.update\(\{\s*worker_id: lockId,/.test(stmt)) {
        assert.match(stmt, /\.eq\('status', 'complete'\)\s*\.or\(claimableOrFilter\(backfillNowIso\)\)/, `${name}: backfill claim must stay lease-aware`)
        continue
      }
      if (/\.eq\('usage_counted', false\)/.test(stmt)) {
        assert.ok(m.index > src.indexOf("await log('completion_skipped'"), `${name}: usage_counted flip must follow the owner-only completion UPDATE`)
        continue
      }
      assert.match(stmt, new RegExp(`\\.eq\\('worker_id', ${workerVar}\\)`), `${name}: unconditioned story_requests UPDATE:\n${stmt}`)
      assert.match(stmt, /\.gt\('worker_lease_expires_at', new Date\(\)\.toISOString\(\)\)/, `${name}: owned UPDATE without an open-window condition:\n${stmt}`)
    }
    assert.ok(count >= 1, `${name}: expected at least one guarded story_requests UPDATE`)
  }
  // The claim itself is the one UPDATE that legitimately runs without our
  // worker id (it is what assigns it); it must stay lease-aware.
  const claim = between('// ── Atomic lease-aware claim', 'if (!claim) {')
  assert.match(claim, /\.or\(claimableOrFilter\(nowIso\)\)\s*\.in\('status', claimableStatuses\)/)
})

test('S3. completion and failure transitions are owner-only (stale worker cannot complete or fail a story)', () => {
  const complete = between('// ── Complete (exactly once)', 'if (!completedRow) {')
  const OPEN = "\\.gt\\('worker_lease_expires_at', new Date\\(\\)\\.toISOString\\(\\)\\)"
  assert.match(complete, new RegExp(`status: 'complete'[\\s\\S]*?\\.eq\\('worker_id', workerId\\)\\s*${OPEN}\\s*\\.neq\\('status', 'complete'\\)\\s*\\.select\\('id'\\)\\s*\\.maybeSingle\\(\\)`))
  assert.match(CATCH, new RegExp(`status: 'failed'[\\s\\S]*?\\.eq\\('id', requestId\\)\\s*\\.eq\\('worker_id', workerId\\)\\s*${OPEN}\\s*\\.select\\('id'\\)\\s*\\.maybeSingle\\(\\)`))
  // The failure email is sent only after the owner-only UPDATE matched a row.
  const emailAt = CATCH.indexOf('api.resend.com/emails')
  const guardAt = CATCH.indexOf('if (!failedRow) {')
  assert.ok(guardAt > 0 && emailAt > guardAt, 'failure email must come after the `if (!failedRow)` early return')
  assert.match(MOCK, /status: 'complete'[\s\S]*?\.eq\('worker_id', workerId\)/)
})

test('S4. a lost lease is routed away from the failure path before classification', () => {
  const lostAt = CATCH.indexOf('if (isLeaseLost(err)) {')
  const classifyAt = CATCH.indexOf('const classified = classifyFailure(err, currentStage)')
  assert.ok(lostAt > 0 && classifyAt > lostAt, 'isLeaseLost must be checked before classifyFailure')
  const lost = CATCH.slice(lostAt, classifyAt)
  assert.match(lost, /await log\('lease_lost', message, 'warning'/)
  assert.match(lost, /reason: 'lease_lost', staleWorker: true/)
  assert.match(lost, /status: 200/)
  assert.doesNotMatch(lost, /\.from\('story_requests'\)/, 'the lease-lost branch writes nothing to the row')
  assert.doesNotMatch(lost, /resend/i, 'the lease-lost branch sends nothing')
})

test('S5. generated story content is written only after a fresh ownership check', () => {
  const text = between('// ── Stage 2: final book from the plan', '// ── Step 1b: Generate quiz')
  const afterText = text.indexOf("await lease.require('after text generation')")
  const beforeSave = text.indexOf("await lease.require('before saving the story')")
  const upsert = text.indexOf(".from('generated_stories')")
  const scenesDelete = text.indexOf(".from('story_scenes').delete().eq('request_id', requestId)")
  const scenesInsert = text.indexOf(".from('story_scenes')\n        .insert(sceneRows)")
  assert.ok(afterText > 0 && beforeSave > afterText, 'ownership re-checked after the book call')
  assert.ok(upsert > beforeSave && scenesDelete > upsert && scenesInsert > scenesDelete, 'require() precedes upsert → scene delete → scene insert')
  // Nothing long-running (no model or storage call) sits between the check and the writes.
  const window = text.slice(beforeSave, scenesInsert)
  assert.doesNotMatch(window, /callOpenAI|generateJsonWithRepair|generateImage|\.storage\b/)
  // The plan checkpoint and usage telemetry stay owner-conditioned.
  const plan = between('// Checkpoint the plan so an interrupted worker', '// Hand the book stage')
  assert.match(plan, /story_plan: plan[\s\S]*?\.eq\('worker_id', workerId\)/)
  assert.match(text, /generation_usage: stageUsage \}\)\s*\.eq\('id', requestId\)\s*\.eq\('worker_id', workerId\)/)
  assert.match(PIPELINE, /await lease\.require\('after story planning'\)/)
})

test('S6. scene image references: ownership is re-asserted after the image call, before the upload and before the row write; the write never replaces a completed page', () => {
  const loop = between('for (const scene of pendingScenes) {', '// ── Cover (Phase 1F)')
  const heartbeat = loop.indexOf('await lease.renewOrThrow(`before page ${scene.page_number}`)')
  const gen = loop.indexOf('const image = await generateImage(built.prompt)')
  const afterGen = loop.indexOf('await lease.renewOrThrow(`after page ${scene.page_number} image generation`)')
  const upload = loop.indexOf(".from('story-images')")
  const beforeWrite = loop.indexOf('await lease.require(`before page ${scene.page_number} scene write`)')
  const write = loop.indexOf("image_status: 'complete'")
  assert.ok(heartbeat > 0 && gen > heartbeat && afterGen > gen && upload > afterGen && beforeWrite > upload && write > beforeWrite,
    'order must be heartbeat → generate → renewOrThrow → upload → require → scene write')
  const complete = loop.slice(write, loop.indexOf('imagesGenerated++'))
  assert.match(complete, /\.eq\('id', scene\.id\)\s*\.eq\('request_id', requestId\)\s*\.neq\('image_status', 'complete'\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/)
  assert.match(complete, /scene_write_skipped/)
  const failure = loop.slice(loop.indexOf('} catch (imgErr) {'))
  assert.match(failure, /if \(isLeaseLost\(imgErr\)\) throw imgErr/)
  assert.match(failure, /image_status: 'failed'[\s\S]*?\.eq\('id', scene\.id\)\s*\.eq\('request_id', requestId\)\s*\.neq\('image_status', 'complete'\)/)
  // Image generation inputs are unchanged by the hardening.
  assert.match(loop, /buildImagePrompt\(\{\s*bible: visualBible,\s*pageNumber: scene\.page_number,\s*imageDescription: scene\.image_prompt,/)
  assert.match(loop, /sceneStoragePath\(requestId, scene\.page_number, image\.ext\)/)
  assert.match(loop, /upsert: true/)
})

test('S7. cover references: ownership checked before start, after generation (before upload) and before the reference is recorded', () => {
  const start = COVER.indexOf("if (!(await args.ownsLease())) return stale('before start')")
  const generating = COVER.indexOf("cover_status: 'generating'")
  const gen = COVER.indexOf('const image = await generateImage(built.prompt)')
  const afterGen = COVER.indexOf("if (!(await args.ownsLease())) return stale('after generation')")
  const upload = COVER.indexOf(".from('story-images')")
  const beforeRecord = COVER.indexOf("if (!(await args.ownsLease())) return stale('before recording the cover')")
  const record = COVER.indexOf("cover_status: 'complete'")
  const afterFailure = COVER.indexOf("if (!(await args.ownsLease())) return stale('after failure')")
  const failureWrite = COVER.indexOf('coverFailureUpdate(msg, attempts)')
  assert.ok(start > 0 && generating > start && gen > generating && afterGen > gen && upload > afterGen && beforeRecord > upload && record > beforeRecord,
    'cover order must be check → generating → generate → check → upload → check → record')
  assert.ok(afterFailure > 0 && failureWrite > afterFailure, 'cover failure write is guarded too')
  assert.match(COVER, /coverStoragePath\(requestId, image\.ext\)/)
  assert.match(PIPELINE, /ownsLease: stillOwnsLease,/)
  assert.match(BACKFILL, /ownsLease: backfillOwnsLease,/)
})

test('S8. the backfill page loop re-asserts its own lease after the image call and stops quietly on loss', () => {
  const loop = between('for (const scene of missing) {', '// Cover backfill')
  const gen = loop.indexOf('const image = await generateImage(built.prompt)')
  const renew = loop.indexOf('await backfillLease.renewOrThrow(`after page ${scene.page_number} image generation`)')
  const upload = loop.indexOf(".from('story-images')")
  const req = loop.indexOf('await backfillLease.require(`before page ${scene.page_number} scene write`)')
  const write = loop.indexOf("image_status: 'complete'")
  assert.ok(gen > 0 && renew > gen && upload > renew && req > upload && write > req)
  assert.match(loop, /\.eq\('id', scene\.id\)\s*\.eq\('request_id', requestId\)/)
  assert.match(loop, /if \(isLeaseLost\(e\)\) \{[\s\S]*?break\s*\}/)
  assert.match(loop, /status_message: `Generating illustrations…[\s\S]*?\.eq\('worker_id', lockId\)/)
  assert.match(BACKFILL, /const backfillLease = createLeaseGuard\(supabaseLeaseStore\(supabase, requestId, lockId\), \{ workerId: lockId, leaseMs: BACKFILL_LEASE_MS \}\)/)
})

test('S9. legitimate continuation after the time budget is preserved: owner-only release + self-dispatch, and the released row is claimable again', () => {
  const budget = between('// ── Time budget check', '// ── Generate + upload one image')
  assert.match(budget, /worker_id: null,\s*worker_lease_expires_at: null,\s*status: 'generating_images'[\s\S]*?\.eq\('id', requestId\)\s*\.eq\('worker_id', workerId\)/)
  assert.match(budget, /dispatchSelf\(\{ requestId, language, mode: 'continue' \}\)/)
  const coverHandoff = between('if (!coverGuard.allowed) {', 'await lease.renewOrThrow(\'before the cover\')')
  assert.match(coverHandoff, /worker_id: null,[\s\S]*?\.eq\('worker_id', workerId\)/)
  const planHandoff = between('// Hand the book stage to a fresh invocation', '// ── Stage 2')
  assert.match(planHandoff, /worker_id: null,[\s\S]*?\.eq\('worker_id', workerId\)/)
  // A released row (worker_id null) is free for the next invocation and for the sweep.
  const released = { status: 'generating_images', worker_id: null, worker_lease_expires_at: null, updated_at: new Date(Date.now() - 60_000).toISOString() }
  assert.equal(leaseIsFree(released, Date.now()), true)
  assert.equal(isSweepEligible(released, Date.now()), true)
  assert.equal(claimableOrFilter('2026-10-15T12:00:00.000Z'), 'worker_id.is.null,worker_lease_expires_at.is.null,worker_lease_expires_at.lt.2026-10-15T12:00:00.000Z')
})

test('S10. retry and recovery semantics are unchanged: claimable statuses, sweep statuses and the retry route contract', () => {
  assert.deepEqual([...CLAIMABLE_STATUSES], ['queued', 'failed', 'generating_text', 'generating_images'])
  assert.match(INDEX, /\.in\('status', \['queued', 'generating_text', 'generating_images'\]\)/, 'sweep still targets in-flight rows only')
  const retry = readFileSync(resolve(import.meta.dirname, '../../../app/api/story/[requestId]/retry/route.ts'), 'utf8')
  assert.match(retry, /status: 'queued',[\s\S]*?worker_id: null,\s*worker_lease_expires_at: null,\s*worker_heartbeat_at: null,/)
  assert.match(retry, /checkRetryEligibility\(/)
  // The stale branch leaves failure classification and retry fields alone.
  const lost = CATCH.slice(CATCH.indexOf('if (isLeaseLost(err)) {'), CATCH.indexOf('const classified = classifyFailure'))
  assert.doesNotMatch(lost, /retryable|failure_code|retry_after/)
})

test('S11. the lease module stays Node-importable (no Deno or Supabase imports)', () => {
  const lease = readFileSync(resolve(import.meta.dirname, 'lease.ts'), 'utf8')
  assert.doesNotMatch(lease, /^\s*import .* from /m)
  assert.doesNotMatch(lease, /Deno\./)
})

// ── PR #30 review additions ──────────────────────────────────────────────────

test('S12. scene failure writes are ownership-gated and never replace a completed page (pipeline and backfill)', () => {
  const loop = between('for (const scene of pendingScenes) {', '// ── Cover (Phase 1F)')
  const imgCatch = loop.slice(loop.indexOf('} catch (imgErr) {'))
  // Order inside the catch: lost-lease re-throw, then an ownership renewal, then the failure write.
  const rethrow = imgCatch.indexOf('if (isLeaseLost(imgErr)) throw imgErr')
  const req = imgCatch.indexOf("await lease.require(`before page ${scene.page_number} failure write`)")
  const write = imgCatch.indexOf("image_status: 'failed'")
  assert.ok(rethrow !== -1 && req > rethrow && write > req, 'pipeline failure write must follow the lease checkpoint')
  const failStmt = imgCatch.slice(write, imgCatch.indexOf('\n\n', write) === -1 ? undefined : imgCatch.indexOf('\n', write + 200))
  assert.match(failStmt, /\.eq\('request_id', requestId\)\s*\.neq\('image_status', 'complete'\)/)

  const bloop = between('for (const scene of missing) {', '// Cover backfill')
  const bCatch = bloop.slice(bloop.indexOf('} catch (e) {'))
  const bLost = bCatch.indexOf('if (isLeaseLost(e)) {')
  const bHeart = bCatch.indexOf('if (!(await backfillLease.heartbeat())) {')
  const bWrite = bCatch.indexOf("update({ image_status: 'failed' })")
  assert.ok(bLost !== -1 && bHeart > bLost && bWrite > bHeart, 'backfill failure write must follow the lease renewal')
  assert.match(bCatch.slice(bHeart, bWrite), /break/, 'a lost lease stops the backfill loop')
  assert.match(bCatch.slice(bWrite, bWrite + 200), /\.eq\('request_id', requestId\)\.neq\('image_status', 'complete'\)/)
})

test('S13. ownership callbacks handed to the cover stage are renewals (open window for the write that follows), not reads', () => {
  assert.match(INDEX, /const stillOwnsLease = \(\) => lease\.heartbeat\(\)/)
  assert.match(BACKFILL, /const backfillOwnsLease = \(\) => backfillLease\.heartbeat\(\)/)
  assert.doesNotMatch(INDEX, /\.stillOwns\(\)/, 'index.ts never relies on a read-only ownership check')
})

test('S14. the quiz row (written after a long call) is lease-gated and a lost lease is not swallowed as a quiz failure', () => {
  const quiz = between('// ── Step 1b: Generate quiz', '// ── Step 2')
  const req = quiz.indexOf("await lease.require('before saving the quiz')")
  const ins = quiz.indexOf(".from('story_quizzes')")
  assert.ok(req !== -1 && ins > req)
  assert.match(quiz, /} catch \(quizErr\) \{\s*if \(isLeaseLost\(quizErr\)\) throw quizErr/)
})
