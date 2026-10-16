// 3C-5 mobile swipe-to-delete: behaviour tests over the framework-free gesture
// model (lib/account/swipeReveal.ts), the deletion flow it hands off to
// (lib/account/storyDeletion.ts), and source pins on StoryRow, StoryRowActions,
// useSwipeReveal, the dictionaries and the untouched server side.
// Run: node --experimental-strip-types --test lib/account/swipeReveal.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_SWIPE_CONFIG, RESTING, clampOffset, createSwipeTracker, type SwipeState } from './swipeReveal.ts'
import { canOfferStoryDeletion, createDeleteFlow, type RemovedOutcome } from './storyDeletion.ts'
import { dictionaries } from '../i18n/index.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')
const sha = (rel: string) => createHash('sha256').update(readFileSync(resolve(ROOT, rel))).digest('hex')
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const W = DEFAULT_SWIPE_CONFIG.width
const STORY = 'aaaaaaaa-0000-4000-8000-000000000004'

const PAGE = 'app/account/archived/page.tsx'
const ROW = 'components/account/StoryRow.tsx'
const ACTIONS = 'components/account/StoryRowActions.tsx'
const LIST = 'components/account/StoryList.tsx'
const DIALOG = 'components/account/DeleteStoryDialog.tsx'
const HOOK = 'components/account/useStoryDeletion.ts'
const SWIPE_HOOK = 'components/account/useSwipeReveal.ts'
const SWIPE_LOGIC = 'lib/account/swipeReveal.ts'
const LOGIC = 'lib/account/storyDeletion.ts'
const DELETION_DIR = ['lib', 'deletion'].join('/')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const p = resolve(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|sql|json|mjs)$/.test(name)) out.push(p)
  }
  return out
}
const FILES = ['app', 'components', 'lib', 'supabase'].flatMap((d) => walk(resolve(ROOT, d)))

/** Drives a tracker through a finger path: start at (0,0), then each point, then end. */
function swipe(points: [number, number][], opts: { revealed?: boolean; cancel?: boolean } = {}) {
  const t = createSwipeTracker()
  if (opts.revealed) t.setRevealed(true)
  const states: SwipeState[] = [t.start(0, 0)]
  for (const [x, y] of points) states.push(t.move(x, y))
  states.push(opts.cancel ? t.cancel() : t.end())
  return { t, states, final: t.state }
}

// ── Gate and eligibility (unchanged rule, now feeding the phone presentation) ──

test('1. feature gate OFF / missing / read error: no phone Delete panel and no More actions control', () => {
  for (const enabled of [false, undefined, null, 'true', 1] as unknown[]) {
    assert.equal(canOfferStoryDeletion({ enabled: enabled as boolean, status: 'failed', archivedAt: '2026-10-15T00:00:00.000Z' }), false, String(enabled))
  }
  assert.match(read(PAGE), /isSettingEnabled\('customer_story_deletion_enabled', false\)\.catch\(\(\) => false\)/)
  const row = read(ROW)
  // Panel, swipe enablement, More actions and dialog all hang off the same `deletable` flag.
  assert.match(row, /const deletable = mode === 'restore' && canOfferStoryDeletion\(/)
  assert.match(row, /useSwipeReveal\(\{ enabled: deletable && phone && !dialogOpen \}\)/)
  assert.match(row, /\{deletable && \(\s*<div[^>]*className="absolute inset-y-0 right-0 flex md:hidden"/)
  assert.match(row, /deletable=\{deletable\}/)
  assert.match(read(ACTIONS), /\{deletable && \(\s*<button\s*ref=\{moreButtonRef\}/, 'More actions renders only under `deletable`')
})

test('2. eligible vs ineligible rows: only archived + failed rows on the archived list get the phone Delete', () => {
  const A = '2026-10-15T00:00:00.000Z'
  assert.equal(canOfferStoryDeletion({ enabled: true, status: 'failed', archivedAt: A }), true)
  for (const status of ['complete', 'queued', 'generating_text', 'generating_images', 'assembling_pdf']) {
    assert.equal(canOfferStoryDeletion({ enabled: true, status, archivedAt: A }), false, status)
  }
  assert.equal(canOfferStoryDeletion({ enabled: true, status: 'failed', archivedAt: null }), false)
  assert.doesNotMatch(read('app/account/page.tsx'), /deletionEnabled|customer_story_deletion/, 'the active list never passes the setting')
  // Guest stories never reach these pages (both pages redirect without a session and query by user_id).
  assert.match(read(PAGE), /\.eq\('user_id', user\.id\)/)
})

test('3. breakpoint behaviour: the gesture and the panel exist below md only; the desktop button from md up only', () => {
  const hook = read(SWIPE_HOOK)
  assert.match(hook, /export const PHONE_MEDIA_QUERY = '\(max-width: 767px\)'/)
  assert.match(hook, /const \[phone, setPhone\] = useState\(false\)/, 'server render and first paint: no gesture')
  assert.match(hook, /mq\.addEventListener\('change', update\)/, 'a resized viewport flips the gesture on or off')
  assert.match(stripComments(hook), /handlers: enabled\s*\?\s*\{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture \}\s*:\s*\{ onClickCapture \}/, 'no pointer handlers while disabled')
  // A swallowed click belongs to the drag that caused it: every new touch and every disable reset the flag,
  // so the first tap after a swipe (or after the dialog closes) reaches its button or link.
  assert.match(stripComments(hook), /pointerId\.current = e\.pointerId\s*swallowClick\.current = false\s*apply\(tracker\.start\(/, 'pointerdown starts clean')
  assert.match(stripComments(hook), /if \(!enabled\) \{ swallowClick\.current = false; close\(\) \}/, 'disable forgets the pending swallow')
  const row = read(ROW)
  assert.match(row, /const phone = usePhoneViewport\(\)/)
  assert.match(row, /className="absolute inset-y-0 right-0 flex md:hidden"/, 'panel hidden from md up')
  assert.match(read(ACTIONS), /className="hidden md:inline-flex[^"]*text-red-600/, 'desktop trigger hidden below md')
  assert.match(read(ACTIONS), /className="md:hidden inline-flex items-center justify-center min-h-11 min-w-11/, 'More actions hidden from md up')
})

// ── Gesture model ──

test('4. a deliberate left swipe reveals the Delete panel (and only reveals: nothing is sent)', async () => {
  const { states, final } = swipe([[-5, 0], [-30, 1], [-60, 2]])
  assert.equal(states[1].axis, null, 'no lock below the threshold')
  assert.equal(states[1].offset, 0, 'nothing moves before the lock')
  assert.equal(states[2].axis, 'x')
  assert.equal(states[2].dragging, true)
  assert.equal(states[3].offset, -60)
  assert.deepEqual(final, { offset: -W, revealed: true, dragging: false, axis: null })
  // Revealing drives no deletion: the flow is untouched and no request exists.
  const calls: string[] = []
  const flow = createDeleteFlow(STORY, { onChange: () => {}, onRemoved: () => {}, onUnauthenticated: () => {} }, async (url) => { calls.push(url); return { status: 200, json: async () => ({}) } })
  assert.equal(flow.state.phase, 'idle')
  assert.equal(calls.length, 0)
})

test('5. vertical scrolling does not reveal: a vertical lock leaves the row at rest and the browser scrolls', () => {
  const { states, final } = swipe([[-3, 12], [-20, 60], [-80, 120]])
  assert.equal(states[1].axis, 'y')
  assert.equal(states[1].offset, 0)
  assert.equal(states[2].offset, 0, 'later horizontal movement is ignored once locked vertically')
  assert.equal(states[3].offset, 0)
  assert.deepEqual(final, RESTING)
  // The hook drops the pointer and cancels as soon as the model locks 'y', so a mid-scroll finger never drags the row.
  assert.match(stripComments(read(SWIPE_HOOK)), /if \(next\.axis === 'y'\) \{ pointerId\.current = null; apply\(tracker\.cancel\(\)\); return \}/)
  // pointercancel from the browser (native pan took over) snaps back too.
  const c = swipe([[-30, 0]], { cancel: true })
  assert.deepEqual(c.final, RESTING)
})

test('6. short or accidental swipes do not reveal; a diagonal that is mostly vertical does not either', () => {
  assert.deepEqual(swipe([[-5, 2]]).final, RESTING, 'below the lock threshold = a tap')
  assert.deepEqual(swipe([[-20, 0], [-30, 0]]).final, RESTING, 'locked horizontally but short of 40% of the panel width')
  assert.equal(swipe([[-20, 0], [-(W * 0.4 - 1), 0]]).final.revealed, false)
  assert.equal(swipe([[-20, 0], [-(W * 0.4), 0]]).final.revealed, true, 'exactly the reveal distance reveals')
  assert.deepEqual(swipe([[-10, 14], [-40, 90]]).final, RESTING, 'mostly vertical')
  // A left drag that is pulled back before release snaps home.
  assert.deepEqual(swipe([[-20, 0], [-90, 0], [-10, 0]]).final, RESTING)
})

test('7. a right swipe or an outside interaction closes a revealed row; the row never slides past its bounds', () => {
  const r = swipe([[10, 0], [30, 0]], { revealed: true })
  assert.equal(r.states[2].offset, -W + 30)
  assert.deepEqual(r.final, RESTING, 'right swipe of at least closeDistance closes')
  assert.equal(swipe([[10, 0], [20, 0]], { revealed: true }).final.revealed, true, 'a short right nudge keeps it open')
  // Bounds: never right of rest, never left of the panel.
  assert.equal(clampOffset(50, W), 0)
  assert.equal(clampOffset(-500, W), -W)
  assert.equal(swipe([[20, 0], [80, 0]]).states[2].offset, 0)
  assert.equal(swipe([[-20, 0], [-800, 0]]).states[2].offset, -W)
  // Outside tap, Escape and the accessible control close via setRevealed(false); the hook wires document listeners while revealed.
  const t = createSwipeTracker(); t.setRevealed(true)
  assert.deepEqual(t.setRevealed(false), RESTING)
  const hook = stripComments(read(SWIPE_HOOK))
  assert.match(hook, /if \(!state\.revealed\) return[\s\S]*?document\.addEventListener\('pointerdown', onDown\)[\s\S]*?document\.addEventListener\('keydown', onKey\)/)
  assert.match(hook, /!containerRef\.current\.contains\(e\.target\)\) close\(\)/)
  assert.match(hook, /if \(e\.key === 'Escape'\) close\(\)/)
})

test('8. tapping the revealed Delete opens the existing confirmation; the panel closes first and focus returns afterwards', () => {
  const row = read(ROW)
  assert.match(row, /<button\s*ref=\{panelButton\}[\s\S]*?onClick=\{e => openDelete\(moreButton\.current \?\? e\.currentTarget\)\}/, 'the panel button opens the dialog through the shared openDelete')
  assert.match(row, /const openDelete = useCallback\(\(from: HTMLElement \| null\) => \{\s*trigger\.current = from\s*swipe\.close\(\)\s*del\.open\(\)/)
  assert.match(row, /<DeleteStoryDialog\s*open=\{dialogOpen\}\s*pending=\{del\.pending\}\s*onCancel=\{cancelDelete\}\s*onConfirm=\{del\.confirm\}/)
  assert.match(row, /const cancelDelete = useCallback\(\(\) => \{\s*del\.cancel\(\)\s*trigger\.current\?\.focus\(\)/)
  // The dialog itself is the 3C-4 one, unchanged.
  assert.equal(sha(DIALOG), '8e262ffccb414cb189b8aec39136d9b59c198ea71d6df54cbc190e22209acfca', 'DeleteStoryDialog is byte-identical to 3C-4 (PR #38)')
})

test('9. swiping alone never sends DELETE: the only sender is the flow, reached only through confirm()', async () => {
  const swipeSrc = stripComments(read(SWIPE_LOGIC)) + stripComments(read(SWIPE_HOOK))
  assert.doesNotMatch(swipeSrc, /fetch\(|DELETE|storyDeletion|createDeleteFlow|requestStoryDeletion/, 'the gesture modules know nothing about requests')
  const senders = FILES.filter((f) => !f.endsWith('.test.ts') && /method:\s*['"]DELETE['"]/.test(readFileSync(f, 'utf8')) && /\/api\/story\//.test(readFileSync(f, 'utf8')))
  assert.deepEqual(senders, [resolve(ROOT, LOGIC)])
  // Even a full reveal-then-open sequence sends nothing until the dialog's confirm.
  const calls: string[] = []
  const removed: RemovedOutcome[] = []
  const flow = createDeleteFlow(STORY, { onChange: () => {}, onRemoved: (_, o) => removed.push(o), onUnauthenticated: () => {} }, async (url) => { calls.push(url); return { status: 200, json: async () => ({ ok: true, state: 'deleted' }) } })
  swipe([[-20, 0], [-90, 0]])
  flow.open()
  assert.equal(calls.length, 0)
  await flow.confirm()
  assert.deepEqual(calls, [`/api/story/${STORY}`])
  assert.deepEqual(removed, ['deleted'])
})

// ── Accessibility ──

test('10. non-gesture alternative: a labelled "More actions" button (≥44px) reveals the same panel and moves focus to Delete; it never reveals a second action', () => {
  const actions = read(ACTIONS)
  assert.match(actions, /<button\s*ref=\{moreButtonRef\}\s*type="button"\s*onClick=\{onToggleReveal\}\s*disabled=\{busy \|\| deletePending\}\s*aria-expanded=\{revealed\}\s*aria-label=\{a\.moreActions\}\s*title=\{a\.moreActions\}/)
  assert.match(actions, /min-h-11 min-w-11/, '44px touch target')
  assert.match(actions, /<span aria-hidden="true" className="text-xl leading-none">⋯<\/span>/, 'the glyph is decorative; the label is the accessible name')
  const row = read(ROW)
  assert.match(row, /const toggleReveal = useCallback\(\(\) => \{\s*if \(swipe\.revealed\) \{\s*swipe\.close\(\)\s*moreButton\.current\?\.focus\(\)\s*\} else \{\s*swipe\.open\(\)[\s\S]*?panelButton\.current\?\.focus\(\)/)
  assert.match(row, /tabIndex=\{swipe\.revealed \? 0 : -1\}/, 'the panel button is reachable only once revealed')
  assert.match(row, /aria-hidden=\{!swipe\.revealed\}/, 'the hidden panel is not announced')
  assert.match(row, /aria-label=\{a\.deleteAria\}/)
  assert.match(row, /min-h-11 bg-red-600 text-white/, 'the revealed action is a full-height, clearly destructive button')
  // One action in the panel.
  const panel = row.slice(row.indexOf('absolute inset-y-0 right-0'), row.indexOf('{...swipe.handlers}'))
  assert.equal((panel.match(/<button/g) ?? []).length, 1)
})

test('11. EN/ES labels for every phone control', () => {
  for (const lang of ['en', 'es'] as const) {
    const a = dictionaries[lang].account
    assert.equal(a.moreActions, lang === 'en' ? 'More actions' : 'Más acciones')
    assert.equal(a.deleteForever, lang === 'en' ? 'Delete permanently' : 'Eliminar permanentemente')
    assert.equal(a.deleteAria, lang === 'en' ? 'Delete story permanently' : 'Eliminar cuento permanentemente')
    assert.notEqual(a.moreActions, a.restore)
    assert.notEqual(a.moreActions, a.deleteForever)
  }
  const es = dictionaries.es.account as Record<string, unknown>, en = dictionaries.en.account as Record<string, unknown>
  for (const k of Object.keys(en).filter((k) => /^(delete|moreActions)/.test(k))) assert.ok(typeof es[k] === 'string' && es[k] !== en[k], `${k} translated`)
})

// ── Outcomes through the shared flow (unchanged) ──

test('12. 200/202/409/404/401/500 behave as in 3C-4 for a deletion started from the phone panel', async () => {
  async function run(status: number, body: unknown) {
    const removed: RemovedOutcome[] = []
    let unauth = 0
    const flow = createDeleteFlow(STORY, { onChange: () => {}, onRemoved: (_, o) => removed.push(o), onUnauthenticated: () => { unauth++ } }, async () => ({ status, json: async () => body }))
    flow.open(); await flow.confirm()
    return { removed, unauth, error: flow.state.error }
  }
  assert.deepEqual(await run(200, { ok: true, state: 'deleted' }), { removed: ['deleted'], unauth: 0, error: null })
  assert.deepEqual(await run(202, { ok: true, state: 'cleanup_pending' }), { removed: ['cleanup_pending'], unauth: 0, error: null })
  assert.deepEqual(await run(409, { code: 'NOT_ELIGIBLE' }), { removed: [], unauth: 0, error: 'not_eligible' })
  assert.deepEqual(await run(404, { code: 'NOT_FOUND' }), { removed: ['gone'], unauth: 0, error: null })
  assert.deepEqual(await run(401, { message: 'Unauthorized' }), { removed: [], unauth: 1, error: null })
  assert.deepEqual(await run(500, { code: 'INTERNAL_ERROR' }), { removed: [], unauth: 0, error: 'failed' })
  // The list's removal/notice and the row's alert are the 3C-4 ones.
  assert.match(read(LIST), /setRows\(prev => prev\.filter\(r => r\.story\.id !== requestId\)\)/)
  assert.match(read(LIST), /<div role="status" aria-live="polite">/)
  assert.match(read(ACTIONS), /\{message && <span role="alert"/)
  assert.match(read(ROW), /deleteError=\{del\.error\}/)
  assert.doesNotMatch(dictionaries.en.account.deleteStarted, /deleted\.|fully|complete/i)
})

test('13. duplicate request prevention and conflicting actions while pending', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => { release = r })
  const calls: string[] = []
  const flow = createDeleteFlow(STORY, { onChange: () => {}, onRemoved: () => {}, onUnauthenticated: () => {} }, async (url) => { calls.push(url); await gate; return { status: 200, json: async () => ({}) } })
  flow.open()
  const p1 = flow.confirm(); const p2 = flow.confirm(); flow.open(); flow.cancel(); const p3 = flow.confirm()
  release(); await Promise.all([p1, p2, p3])
  assert.equal(calls.length, 1)
  const row = read(ROW)
  // Gesture off while the dialog is open or the request is in flight; panel button, More actions and Restore disabled.
  assert.match(row, /useSwipeReveal\(\{ enabled: deletable && phone && !dialogOpen \}\)/)
  assert.match(row, /disabled=\{del\.pending \|\| !showPanel\}/)
  assert.match(stripComments(read(SWIPE_HOOK)), /useEffect\(\(\) => \{ if \(!enabled\) \{ swallowClick\.current = false; close\(\) \} \}, \[enabled, close\]\)/, 'disabling rests the row')
  const actions = read(ACTIONS)
  assert.match(actions, /onClick=\{onToggleReveal\}\s*disabled=\{busy \|\| deletePending\}/)
})

test('14. Restore is disabled while a deletion is pending (and Delete controls while Restore is in flight)', () => {
  const src = stripComments(read(ACTIONS))
  const restoreButton = src.slice(src.indexOf('<button'), src.indexOf('</button>'))
  assert.match(restoreButton, /onClick=\{go\}/)
  assert.match(restoreButton, /disabled=\{busy \|\| deletePending\}/)
  assert.match(src, /async function go\(\) \{\s*if \(deletePending\) return/)
  assert.equal((src.match(/disabled=\{busy \|\| deletePending\}/g) ?? []).length, 3, 'Restore, desktop Delete and More actions share the lock')
})

test('15. reduced motion: the slide has no transition under prefers-reduced-motion and no transition while dragging', () => {
  const row = read(ROW)
  assert.match(row, /\$\{swipe\.dragging \? 'transition-none' : 'transition-transform duration-200 ease-out motion-reduce:transition-none'\}/)
  // The model's state is the same either way: reveal is a position, not an animation.
  assert.equal(swipe([[-20, 0], [-90, 0]]).final.offset, -W)
  assert.doesNotMatch(read(SWIPE_LOGIC) + read(SWIPE_HOOK), /requestAnimationFrame|setTimeout|animate\(/, 'no JS animation to bypass the CSS preference')
})

test('16. no horizontal overflow: the wrapper clips, the panel sits inside the row box, the content only transforms', () => {
  const row = read(ROW)
  assert.match(row, /className="relative rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-brand-200 transition-colors"/)
  assert.match(row, /className="absolute inset-y-0 right-0 flex md:hidden"\s*style=\{\{ width: DEFAULT_SWIPE_CONFIG\.width \}\}/)
  assert.match(row, /style=\{\{ transform: `translateX\(\$\{swipe\.offset\}px\)`, touchAction: 'pan-y' \}\}/)
  assert.doesNotMatch(row, /margin-left|marginLeft|left:\s*-|-ml-|w-\[calc/, 'no layout-affecting shift')
  assert.equal(DEFAULT_SWIPE_CONFIG.width, 104)
  assert.ok(DEFAULT_SWIPE_CONFIG.width < 320 / 2, 'the panel leaves most of a 320px row visible')
  // The link and image never start a native drag that would fight the gesture.
  assert.equal((row.match(/draggable=\{false\}/g) ?? []).length, 2)
  // A kept-row outcome (409/500) never widens the row on phones: it wraps onto its own line
  // under the content (basis-full), while md and up keeps the 3C-4 placement beside the buttons.
  assert.match(read(ROW), /className=\{`relative flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1\.5 bg-white/)
  assert.match(read(ROW), /\{deletable && errorKey && \(\s*<p role="alert" className="basis-full md:hidden text-\[10px\] leading-tight text-red-500 text-right">\s*\{a\[errorKey\]\}/)
  assert.match(read(ACTIONS), /className=\{`text-\[10px\] text-red-500 text-right\$\{error \? '' : ' hidden md:inline'\}`\}/, 'the column message is desktop-only for deletion outcomes; Restore errors stay visible everywhere')
  assert.match(read(ROW), /className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0"/, 'the link has a zero flex basis, so a long title never pushes the actions onto a second line')
})

test('17. no desktop regression: the md-and-up presentation is the 3C-4 one', () => {
  const actions = read(ACTIONS)
  assert.match(actions, /text-\[11px\] font-semibold text-brand-600 hover:text-brand-700/)
  assert.match(actions, /className="hidden md:inline-flex text-\[11px\] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"/)
  assert.match(actions, /\{deletePending \? a\.deletePending : a\.deleteForever\}/)
  assert.match(actions, /aria-haspopup="dialog"\s*aria-label=\{a\.deleteAria\}/)
  const row = read(ROW)
  assert.match(row, /const phone = usePhoneViewport\(\)/)
  assert.match(row, /enabled: deletable && phone/, 'desktop never gets pointer handlers')
  assert.match(row, /<Link href=\{`\/story\/\$\{story\.id\}`\}/)
  assert.match(row, /<StatusBadge status=\{story\.status\} labels=\{a\.statuses\} \/>/)
  assert.match(read(LIST), /onRemoved=\{handleRemoved\}/)
  assert.match(read(LIST), /deletionEnabled=\{deletionEnabled\}/)
})

test('18. no new endpoint, migration, setting seed or production change; server side hash-pinned', () => {
  assert.equal(sha('app/api/story/[requestId]/route.ts'), '2c546febba4d839b3d5919bb44c9f970848befa967813a01c5cb0408c3ffee39')
  assert.equal(sha('app/api/story/[requestId]/restore/route.ts'), '59fe0d859b765326e2d97ce68f89194eb22cfbba5fd1a97a8d359fd5d194a7d5')
  assert.equal(sha(`${DELETION_DIR}/customerDeleteRoute.ts`), '602cb11306e04d1480775b7b0649a2bfbd5ef77c056a9b429dcdcb52cf4217e8')
  assert.equal(sha(`${DELETION_DIR}/deleteFailedStory.ts`), '19ae7d1812ca87c7e3436f9fb878483932a705fe747b908244d371e9be7da8ad')
  assert.equal(sha(`${DELETION_DIR}/reconcileStartedDeletions.ts`), '5c03f76721a79c4cb37db9e8fa52efb912f2e7f83b26729d50e7fdd56e61a55b')
  assert.equal(sha('app/api/cron/deletion-sweep/route.ts'), '1a77481e9d2104fb3a2329bf2a5f05dd7e0ca0455dc3e329291c5a1172adbb67')
  assert.equal(sha('lib/i18n/legal.ts'), '0e4ccfae77d0ea338f539c24df85ef0f878a1d7c0832301bb44e75b42eea9e2c')
  assert.equal(readdirSync(resolve(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort().at(-1), '20240075_deletion_count_durability.sql')
  const routes = FILES.filter((p) => /app\/api\/story\/.*route\.tsx?$/.test(p) && /export (async )?function DELETE/.test(readFileSync(p, 'utf8')))
  assert.deepEqual(routes, [resolve(ROOT, 'app/api/story/[requestId]/route.ts')], 'the 3C-3 route is still the only story DELETE handler')
  const customerDeleteSenders = FILES.filter((p) => /\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p) && /\/(components\/account|lib\/account|app\/account)\//.test(p) && /method:\s*'DELETE'/.test(readFileSync(p, 'utf8')))
  assert.deepEqual(customerDeleteSenders, [resolve(ROOT, 'lib/account/storyDeletion.ts')], 'one client sender of DELETE, unchanged from 3C-4')
  const refs = FILES.filter((f) => !f.endsWith('.test.ts') && readFileSync(f, 'utf8').includes('customer_story_deletion_enabled'))
  assert.deepEqual(refs.sort(), [resolve(ROOT, 'app/api/story/[requestId]/route.ts'), resolve(ROOT, DELETION_DIR, 'customerDeleteRoute.ts'), resolve(ROOT, PAGE)].sort())
  for (const f of FILES.filter((f) => /supabase\/migrations\/.*\.sql$/.test(f) || /\/(app|components)\/admin\//.test(f))) assert.doesNotMatch(readFileSync(f, 'utf8'), /customer_story_deletion/, f)
  for (const f of [ROW, ACTIONS, LIST, DIALOG, HOOK, SWIPE_HOOK, SWIPE_LOGIC, LOGIC]) {
    assert.doesNotMatch(read(f), /updateSetting|app_settings|\.insert\(|\.upsert\(|\.update\(|createAdminClient|supabase/, `${f} touches settings or the database`)
  }
  // The archived page only READS the gate (default false, failure → false); it never writes a setting.
  const page = read(PAGE)
  assert.doesNotMatch(page, /updateSetting|app_settings|\.insert\(|\.upsert\(|\.update\(|\.delete\(/, 'the archived page writes nothing')
  assert.match(page, /isSettingEnabled\('customer_story_deletion_enabled', false\)\s*\.catch\(\(\) => false\)/)
  assert.equal((page.match(/isSettingEnabled\(/g) ?? []).length, 1)
  // The gesture modules are pure UI: no server, worker, record, storage or purchase vocabulary.
  for (const f of [SWIPE_HOOK, SWIPE_LOGIC]) {
    assert.doesNotMatch(read(f), /worker|deletion_log|delete_failed_story|complete_story_deletion|story_purchases|storage|bucket|\.rpc\(|user_id/i, `${f}`)
  }
  assert.doesNotMatch(stripComments(read(SWIPE_LOGIC)), /^import /m, 'the model imports nothing')
})
