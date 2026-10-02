// Run: node --experimental-strip-types --test lib/limits/claimLifecycle.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { memoryClaimStore, runClaimed } from './claimLifecycle.ts'
import { exportIsCurrent, idsToDemote, pdfClaimKey } from '../services/pdfExports.ts'

test('CLAIMS 4/5. failed ready email releases its claim; successful one retains it', async () => {
  const store = memoryClaimStore()
  let sends = 0
  const failing = () => runClaimed(store, 'ready_email:r1', 'ready_email', 'r1', async () => { sends++; throw new Error('resend 503') })
  const r1 = await failing()
  assert.equal(r1.outcome, 'failed')
  assert.equal(r1.outcome === 'failed' && r1.released, true)
  assert.deepEqual(store.held(), [], 'claim released after the failed send')
  // next attempt can claim and succeed
  const r2 = await runClaimed(store, 'ready_email:r1', 'ready_email', 'r1', async () => { sends++; return 'msg-1' })
  assert.equal(r2.outcome, 'done')
  assert.deepEqual(store.held(), ['ready_email:r1'], 'claim kept after success')
  // subsequent attempt stays rejected
  const r3 = await runClaimed(store, 'ready_email:r1', 'ready_email', 'r1', async () => { sends++; return 'msg-2' })
  assert.equal(r3.outcome, 'already_claimed')
  assert.equal(sends, 2)
})

test('CLAIMS 6/7. failed PDF render releases its claim; successful render retains it', async () => {
  const store = memoryClaimStore()
  const key = pdfClaimKey('r2', '2026-10-01T12:00:00Z')
  const r1 = await runClaimed(store, key, 'pdf_assembly', 'r2', async () => { throw new Error('upload failed') })
  assert.equal(r1.outcome, 'failed')
  assert.deepEqual(store.held(), [])
  const r2 = await runClaimed(store, key, 'pdf_assembly', 'r2', async () => ({ pageCount: 12 }))
  assert.equal(r2.outcome, 'done')
  assert.deepEqual(store.held(), [key])
  const r3 = await runClaimed(store, key, 'pdf_assembly', 'r2', async () => ({ pageCount: 12 }))
  assert.equal(r3.outcome, 'already_claimed')
})

test('CLAIMS 8. two concurrent callers: exactly one side effect, the other is rejected', async () => {
  const store = memoryClaimStore()
  let effects = 0
  const slow = async () => { effects++; await new Promise(r => setTimeout(r, 5)); return 'ok' }
  const [a, b] = await Promise.all([
    runClaimed(store, 'ready_email:r3', 'ready_email', 'r3', slow),
    runClaimed(store, 'ready_email:r3', 'ready_email', 'r3', slow),
  ])
  assert.deepEqual([a.outcome, b.outcome].sort(), ['already_claimed', 'done'])
  assert.equal(effects, 1)
})

test('release is scoped to key AND scope, so it cannot delete another operation\'s claim', async () => {
  const store = memoryClaimStore()
  await store.claim('shared-key', 'pdf_assembly', 'r4')
  await store.release('shared-key', 'ready_email')
  assert.deepEqual(store.held(), ['shared-key'])
})

test('an unavailable store runs the effect (fail open) and never tries to release', async () => {
  let releases = 0
  const store = {
    async claim() { return 'unavailable' as const },
    async release() { releases++ },
  }
  const r = await runClaimed(store, 'k', 's', 'r5', async () => { throw new Error('boom') })
  assert.equal(r.outcome, 'failed')
  assert.equal(r.outcome === 'failed' && r.released, false)
  assert.equal(releases, 0)
})

test('PDF 18. a replacement export leaves exactly one latest row, keyed per completion', () => {
  const rows = [
    { id: 'old', created_at: '2026-09-30T10:00:00Z', is_latest: true },
    { id: 'older', created_at: '2026-09-29T10:00:00Z', is_latest: false },
    { id: 'new', created_at: '2026-10-01T12:05:00Z', is_latest: true },
  ]
  const demote = idsToDemote(rows, 'new')
  assert.deepEqual(demote, ['old'])
  const after = rows.map(r => ({ ...r, is_latest: r.id === 'new' ? true : (demote.includes(r.id) ? false : r.is_latest) }))
  assert.equal(after.filter(r => r.is_latest).length, 1)
  // currency: the old export is stale once the story is re-completed
  assert.equal(exportIsCurrent(rows[0], '2026-10-01T12:00:00Z'), false)
  assert.equal(exportIsCurrent(rows[2], '2026-10-01T12:00:00Z'), true)
  assert.equal(exportIsCurrent(null, '2026-10-01T12:00:00Z'), false)
  assert.equal(exportIsCurrent(rows[0], null), true, 'no completion stamp keeps legacy behaviour')
  assert.notEqual(pdfClaimKey('r', '2026-09-30T10:00:00Z'), pdfClaimKey('r', '2026-10-01T12:00:00Z'))
  assert.equal(pdfClaimKey('r', null), 'pdf:r')
})
