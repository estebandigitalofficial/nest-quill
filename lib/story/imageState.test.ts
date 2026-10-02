import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  imageGenerationState, imageGenerationLabel,
  sceneImageState, storyImagesSummary, hasImageSkipEvidence,
  readerPlaceholder, adminImagesSuffix, adminImagesTitle,
} from './imageState.ts'

const PENDING = { image_status: 'pending', storage_path: null, last_error: null, generation_attempts: 0 }
const COMPLETE = { image_status: 'complete', storage_path: 'x/1.jpg', last_error: null, generation_attempts: 1 }
const FAILED = { image_status: 'failed', storage_path: null, last_error: 'OpenAI 400: Unknown parameter', generation_attempts: 2 }
const SKIP_LOG = { stage: 'generate_images', message: 'Image generation skipped (image_generation_enabled=false)' }

test('1. Beta ON + Images ON → image generation active (beta is not an input)', () => {
  const s = imageGenerationState({ imageGenEnabled: true, skipEnv: false, betaMode: true })
  assert.equal(s.state, 'active')
  const label = imageGenerationLabel(s)
  assert.equal(label.value, 'Active')
  assert.equal(label.tone, 'green')
  assert.doesNotMatch(label.hint + label.value, /DALL|paused|beta\)/i)
})

test('2. Beta ON + Images OFF → disabled because of the flag, never beta', () => {
  const s = imageGenerationState({ imageGenEnabled: false, skipEnv: false, betaMode: true })
  assert.deepEqual(s, { state: 'disabled', reason: 'flag' })
  const label = imageGenerationLabel(s)
  assert.match(label.value, /Disabled/)
  // 'Beta Ops' is a page name; what must never appear is Beta Mode as the cause.
  assert.doesNotMatch(label.value + label.hint, /beta mode|\(beta\)|during beta|because of beta/i)
  // worker env override is reported honestly and separately
  assert.deepEqual(imageGenerationState({ imageGenEnabled: true, skipEnv: true }), { state: 'disabled', reason: 'worker_env' })
  assert.match(imageGenerationLabel({ state: 'disabled', reason: 'worker_env' }).value, /worker env/)
})

test('3. Failed scene → failed/unavailable, not skipped', () => {
  assert.equal(sceneImageState(FAILED), 'failed')
  const sum = storyImagesSummary({ storyStatus: 'complete', scenes: [FAILED, FAILED], logs: [] })
  assert.equal(sum.state, 'failed')
  assert.equal(sum.failed, 2)
  assert.equal(readerPlaceholder({ imageUrl: null, imageStatus: 'failed' }, sum.state), 'Illustration unavailable.')
  assert.match(adminImagesSuffix(sum), /failed/)
  assert.doesNotMatch(adminImagesSuffix(sum) + adminImagesTitle(sum), /skipped/)
})

test('4. Intentionally disabled → skipped semantics from the worker log line', () => {
  assert.equal(hasImageSkipEvidence([SKIP_LOG]), true)
  assert.equal(hasImageSkipEvidence([{ stage: 'generate_images', message: 'Page 1 illustrated' }]), false)
  const sum = storyImagesSummary({ storyStatus: 'complete', scenes: [PENDING, PENDING], logs: [SKIP_LOG] })
  assert.equal(sum.state, 'skipped')
  assert.equal(readerPlaceholder({ imageUrl: null, imageStatus: 'pending' }, sum.state), 'Illustrations are not available for this book.')
  assert.match(adminImagesSuffix(sum), /skipped/)
})

test('5. Pending scene → pending semantics while the story is still processing', () => {
  assert.equal(sceneImageState(PENDING), 'pending')
  assert.equal(sceneImageState({ image_status: 'generating', storage_path: null }), 'pending')
  const sum = storyImagesSummary({ storyStatus: 'generating_images', scenes: [PENDING, COMPLETE], logs: [] })
  assert.equal(sum.state, 'partial')
  assert.equal(storyImagesSummary({ storyStatus: 'generating_images', scenes: [PENDING], logs: [] }).state, 'pending')
})

test('6. Completed scene → complete semantics; complete row without a path is not an image', () => {
  assert.equal(sceneImageState(COMPLETE), 'complete')
  assert.equal(sceneImageState({ image_status: 'complete', storage_path: null }), 'pending')
  const sum = storyImagesSummary({ storyStatus: 'complete', scenes: [COMPLETE, COMPLETE], logs: [] })
  assert.equal(sum.state, 'complete')
  assert.equal(adminImagesSuffix(sum), '')
})

test('7. Legacy row with ambiguous/null metadata → neutral fallback, no false explanation', () => {
  const legacy = { image_status: 'pending', storage_path: null, last_error: null, generation_attempts: null }
  const sum = storyImagesSummary({ storyStatus: 'complete', scenes: [legacy, legacy], logs: [] })
  assert.equal(sum.state, 'unknown')
  assert.equal(readerPlaceholder({ imageUrl: null, imageStatus: 'pending' }, sum.state), 'Illustration unavailable.')
  assert.doesNotMatch(adminImagesTitle(sum), /beta|skipped/i)
  // no logs at all (undefined) behaves the same
  assert.equal(storyImagesSummary({ storyStatus: 'complete', scenes: [legacy] }).state, 'unknown')
  // zero scenes
  assert.equal(storyImagesSummary({ storyStatus: 'complete', scenes: [] }).state, 'none')
})

test('8. DALL·E / "Paused (beta)" wording removed from live UI', () => {
  const live = [
    'app/admin/page.tsx',
    'components/admin/AdminAlertStrip.tsx',
    'components/admin/AdminStoryActions.tsx',
    'app/admin/writer-config/WriterConfigEditor.tsx',
    'components/story/StoryStatusPage.tsx',
    'app/admin/stories/[requestId]/page.tsx',
    'app/api/story/status/route.ts',
    'lib/story/imageState.ts',
  ]
  for (const f of live) {
    const src = readFileSync(f, 'utf8')
    assert.doesNotMatch(src, /DALL[·.\-‑ ]?E/i, `${f} still mentions DALL·E`)
    assert.doesNotMatch(src, /Paused \(beta\)/, `${f} still says Paused (beta)`)
    assert.doesNotMatch(src, /illustrations paused|generation is paused \(text-only/i, `${f} still says illustrations are paused`)
    assert.doesNotMatch(src, /imagesSkippedReason/, `${f} still uses the collapsed skip reason`)
  }
})

test('9. Reader never exposes a raw provider error', () => {
  for (const state of ['failed', 'unknown', 'skipped', 'partial', 'complete'] as const) {
    const copy = readerPlaceholder({ imageUrl: null, imageStatus: 'failed' }, state)
    assert.ok(copy && !/OpenAI|400|parameter|error/i.test(copy), `${state}: ${copy}`)
  }
  // The reader content route does not select last_error at all.
  const readerRoute = readFileSync('app/api/story/[requestId]/route.ts', 'utf8')
  assert.doesNotMatch(readerRoute, /last_error/)
})

test('10. Existing text-only story still renders: every page gets calm placeholder copy', () => {
  const pages = [1, 2, 3].map(n => ({ pageNumber: n, imageUrl: null, imageStatus: 'pending' }))
  const sum = storyImagesSummary({ storyStatus: 'complete', scenes: pages.map(() => PENDING), logs: [SKIP_LOG] })
  const copy = pages.map(p => readerPlaceholder(p, sum.state))
  assert.deepEqual(copy, Array(3).fill('Illustrations are not available for this book.'))
})

test('11. Existing illustrated story still renders: pages with images get no placeholder', () => {
  const pages = [1, 2].map(n => ({ pageNumber: n, imageUrl: `https://signed/${n}.jpg`, imageStatus: 'complete' }))
  const sum = storyImagesSummary({ storyStatus: 'complete', scenes: [COMPLETE, COMPLETE], logs: [] })
  assert.equal(sum.state, 'complete')
  for (const p of pages) assert.equal(readerPlaceholder(p, sum.state), null)
  // legacy PNG asset path is still an image
  assert.equal(sceneImageState({ image_status: 'complete', storage_path: 'legacy/page1.png' }), 'complete')
})
