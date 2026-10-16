// 3C-4 desktop customer Delete UI: behaviour tests over the framework-free flow
// in lib/account/storyDeletion.ts (the exact logic the account components run)
// plus source pins on the components, the archived page, the dictionaries and
// the untouched 3C-3 route, 3C-6 sweep, 3C-8 legal text and migrations.
// Run: node --experimental-strip-types --test lib/account/storyDeletion.test.ts
//
// Numbering follows the 3C-4 spec's test list (1-34).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  INITIAL_DELETE_FLOW,
  canOfferStoryDeletion,
  classifyDeleteResponse,
  createDeleteFlow,
  deleteFlowReducer,
  deleteNoticeKey,
  removesStoryRow,
  requestStoryDeletion,
  storyDeletePath,
  type DeleteFlowState,
  type DeleteStoryOutcome,
  type RemovedOutcome,
} from './storyDeletion.ts'
import { dictionaries } from '../i18n/index.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')
const sha = (rel: string) => createHash('sha256').update(readFileSync(resolve(ROOT, rel))).digest('hex')
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const STORY = 'aaaaaaaa-0000-4000-8000-000000000004'
const ARCHIVED = '2026-10-15T00:00:00.000Z'

const PAGE = 'app/account/archived/page.tsx'
const ACTIVE_PAGE = 'app/account/page.tsx'
const LIST = 'components/account/StoryList.tsx'
const ROW = 'components/account/StoryRow.tsx'
const ACTIONS = 'components/account/StoryRowActions.tsx'
const DIALOG = 'components/account/DeleteStoryDialog.tsx'
const HOOK = 'components/account/useStoryDeletion.ts'
const LOGIC = 'lib/account/storyDeletion.ts'
const UI_FILES = [LIST, ROW, ACTIONS, DIALOG, HOOK, LOGIC]
// (joined so this file never contains the literal server deletion-module path the importer pins scan for)
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

/** Fake fetch that answers the given status/body and records calls. */
function fakeFetch(status: number, body: unknown = {}, opts: { throws?: boolean; delay?: () => Promise<void> } = {}) {
  const calls: { url: string; method: string }[] = []
  const fn = async (url: string, init: { method: 'DELETE' }) => {
    calls.push({ url, method: init.method })
    if (opts.delay) await opts.delay()
    if (opts.throws) throw new TypeError('Failed to fetch')
    return { status, json: async () => body }
  }
  return { fn, calls }
}

/** Drives the controller like the hook does and records every side effect. */
function harness(status: number, body: unknown = {}, opts: Parameters<typeof fakeFetch>[2] = {}) {
  const f = fakeFetch(status, body, opts)
  const states: DeleteFlowState[] = []
  const removed: { id: string; outcome: RemovedOutcome }[] = []
  let unauthenticated = 0
  const flow = createDeleteFlow(STORY, {
    onChange: (s) => states.push(s),
    onRemoved: (id, outcome) => removed.push({ id, outcome }),
    onUnauthenticated: () => { unauthenticated++ },
  }, f.fn)
  return { flow, calls: f.calls, states, removed, get unauthenticated() { return unauthenticated } }
}

// ── Gate and presentation rule (1-6) ────────────────────────────────────────

test('1. gate OFF: a false setting offers no Delete, whatever the story looks like', () => {
  assert.equal(canOfferStoryDeletion({ enabled: false, status: 'failed', archivedAt: ARCHIVED }), false)
  // The components render the button only from the rule's result.
  const row = read(ROW)
  assert.match(row, /const deletable = mode === 'restore' && canOfferStoryDeletion\(\{ enabled: deletionEnabled, status: story\.status, archivedAt: story\.archived_at \}\)/)
  assert.match(read(ACTIONS), /\{deletable && \(\s*<button/, 'the Delete button is rendered only under `deletable`')
  assert.match(read(ACTIONS), /\{deletable && \(\s*<DeleteStoryDialog/, 'the dialog is mounted only under `deletable`')
})

test('2. missing gate: the archived page reads the setting with fallback false and StoryList/StoryRow default it to false', () => {
  const page = read(PAGE)
  assert.match(page, /isSettingEnabled\('customer_story_deletion_enabled', false\)/)
  assert.match(page, /deletionEnabled=\{deletionEnabled\}/)
  assert.match(read(LIST), /deletionEnabled = false \}: Props/)
  assert.match(read(ROW), /deletionEnabled = false, onRemoved \}: Props/)
  // The active list never offers Delete: it does not pass the setting (archived rows never appear there anyway).
  assert.doesNotMatch(read(ACTIVE_PAGE), /deletionEnabled|customer_story_deletion/)
  // Rule with the default: no Delete.
  assert.equal(canOfferStoryDeletion({ enabled: false, status: 'failed', archivedAt: ARCHIVED }), false)
  // The reader itself maps a missing row to its fallback (lib/settings/gates.ts + appSettings.ts).
  assert.match(read('lib/settings/appSettings.ts'), /if \(error \|\| !data\) return fallback/)
  assert.match(read('lib/settings/gates.ts'), /return fallback\s*\}/)
})

test('3. gate read error: a rejected read becomes false, so no Delete UI', () => {
  assert.match(read(PAGE), /isSettingEnabled\('customer_story_deletion_enabled', false\)\.catch\(\(\) => false\)/)
  // Anything that is not the boolean true is off (strings, numbers, objects, null).
  for (const enabled of [undefined, null, 'true', 1, {}] as unknown[]) {
    assert.equal(canOfferStoryDeletion({ enabled: enabled as boolean, status: 'failed', archivedAt: ARCHIVED }), false, String(enabled))
  }
})

test('4. gate ON + archived failed story: Delete is offered', () => {
  assert.equal(canOfferStoryDeletion({ enabled: true, status: 'failed', archivedAt: ARCHIVED }), true)
})

test('5. gate ON + archived non-failed story: no Delete', () => {
  for (const status of ['complete', 'queued', 'generating_text', 'generating_images', 'assembling_pdf', '']) {
    assert.equal(canOfferStoryDeletion({ enabled: true, status, archivedAt: ARCHIVED }), false, status)
  }
})

test('6. gate ON + failed non-archived story: no Delete (and the active list passes no setting at all)', () => {
  assert.equal(canOfferStoryDeletion({ enabled: true, status: 'failed', archivedAt: null }), false)
  assert.equal(canOfferStoryDeletion({ enabled: true, status: 'failed', archivedAt: undefined }), false)
  assert.equal(canOfferStoryDeletion({ enabled: true, status: 'failed', archivedAt: '' }), false)
  // StoryRow additionally requires the archived-list mode.
  assert.match(read(ROW), /mode === 'restore' && canOfferStoryDeletion/)
})

// ── Restore and Delete side by side (7-8) ───────────────────────────────────

test('7. Restore remains available where it was: the restore button, its route call and the restore route are unchanged', () => {
  const src = read(ACTIONS)
  assert.match(src, /'archive' \| 'restore'/)
  assert.match(src, /fetch\(`\/api\/story\/\$\{requestId\}\/\$\{mode\}`, \{ method: 'POST' \}\)/)
  assert.match(src, /aria-label=\{mode === 'archive' \? a\.archiveAria : a\.restoreAria\}/)
  assert.match(src, /\{busy \? '…' : mode === 'archive' \? a\.archive : a\.restore\}/)
  assert.match(src, /router\.refresh\(\)/, 'archive/restore still refresh the page')
  assert.equal(sha('app/api/story/[requestId]/restore/route.ts'), '59fe0d859b765326e2d97ce68f89194eb22cfbba5fd1a97a8d359fd5d194a7d5', 'restore route unchanged')
  assert.equal(sha('app/api/story/[requestId]/retry/route.ts'), '88f66560100296e2ac732545dca6f73c7ade4dbf72036b39275586d6bf65bfa9', 'retry route unchanged')
  for (const lang of ['en', 'es'] as const) {
    assert.equal(dictionaries[lang].account.restore, lang === 'en' ? 'Restore' : 'Restaurar')
  }
})

test('8. Delete and Restore are distinct in text, accessible name and styling', () => {
  for (const lang of ['en', 'es'] as const) {
    const a = dictionaries[lang].account
    assert.notEqual(a.deleteForever, a.restore)
    assert.notEqual(a.deleteAria, a.restoreAria)
    assert.match(a.deleteForever, lang === 'en' ? /^Delete permanently$/ : /^Eliminar permanentemente$/)
    assert.match(a.deleteAria, lang === 'en' ? /permanently/ : /permanentemente/)
    assert.equal(a.deleteConfirm, a.deleteForever, 'the confirm button repeats the destructive verb')
  }
  const src = read(ACTIONS)
  assert.match(src, /'text-\[11px\] font-semibold text-brand-600 hover:text-brand-700/, 'Restore keeps the brand (non-destructive) colour')
  assert.match(src, /text-red-600 hover:text-red-700/, 'Delete is styled as destructive')
  assert.match(src, /aria-label=\{a\.deleteAria\}/)
  assert.match(src, /aria-haspopup="dialog"/)
})

// ── Confirmation (9-14) ─────────────────────────────────────────────────────

test('9. Delete opens the confirmation, nothing more', () => {
  const h = harness(200, { ok: true, state: 'deleted' })
  h.flow.open()
  assert.deepEqual(h.flow.state, { phase: 'confirming', error: null })
  assert.equal(h.calls.length, 0)
  assert.match(read(ACTIONS), /onClick=\{del\.open\}/)
  assert.match(read(ACTIONS), /open=\{del\.confirming \|\| del\.pending\}/)
  // Opening twice stays confirming; opening while pending changes nothing.
  assert.equal(deleteFlowReducer({ phase: 'confirming', error: null }, { type: 'open' }).phase, 'confirming')
  assert.equal(deleteFlowReducer({ phase: 'pending', error: null }, { type: 'open' }).phase, 'pending')
})

test('10. cancel performs no request and closes the dialog; focus returns to the trigger', async () => {
  const h = harness(200, { ok: true, state: 'deleted' })
  h.flow.open()
  h.flow.cancel()
  assert.deepEqual(h.flow.state, INITIAL_DELETE_FLOW)
  // A confirm after cancel does nothing either (nothing is confirming).
  await h.flow.confirm()
  assert.equal(h.calls.length, 0)
  assert.deepEqual(h.removed, [])
  const actions = read(ACTIONS)
  assert.match(actions, /function cancelDelete\(\) \{\s*del\.cancel\(\)\s*deleteTrigger\.current\?\.focus\(\)/)
  const dialog = read(DIALOG)
  assert.match(dialog, /if \(e\.key === 'Escape'\)[\s\S]*?if \(!pending\) onCancel\(\)/, 'Escape cancels')
  assert.match(dialog, /onClick=\{\(\) => \{ if \(!pending\) onCancel\(\) \}\}/, 'backdrop click cancels')
  assert.match(dialog, /ref=\{cancelRef\}[\s\S]*?onClick=\{onCancel\}/, 'a Cancel button exists')
  assert.match(dialog, /cancelRef\.current\?\.focus\(\)/, 'focus lands on Cancel when the dialog opens')
})

test('11. confirmation copy says the deletion is irreversible (EN/ES) and the dialog shows it', () => {
  assert.match(dictionaries.en.account.deleteBody, /It cannot be restored\./)
  assert.match(dictionaries.en.account.deleteBody, /permanently removes/)
  assert.match(dictionaries.es.account.deleteBody, /No se podrá restaurar\./)
  assert.match(dictionaries.es.account.deleteBody, /de forma permanente/)
  assert.match(dictionaries.en.account.deleteTitle, /^Delete this story permanently\?$/)
  assert.match(dictionaries.es.account.deleteTitle, /^¿Eliminar este cuento permanentemente\?$/)
  const dialog = read(DIALOG)
  for (const key of ['deleteTitle', 'deleteBody', 'deleteFree', 'deleteVsArchive', 'deleteConfirm', 'deleteCancel', 'deletePending']) {
    assert.match(dialog, new RegExp(`a\\.${key}\\b`), `dialog renders ${key}`)
  }
  // Deletion is distinguished from archiving.
  assert.match(dictionaries.en.account.deleteVsArchive, /different from archiving/)
  assert.match(dictionaries.es.account.deleteVsArchive, /distinto de archivar/)
})

test('12. confirmation copy says the account remains', () => {
  assert.match(dictionaries.en.account.deleteBody, /Your account will remain open\./)
  assert.match(dictionaries.es.account.deleteBody, /Tu cuenta seguirá abierta\./)
})

test('13. confirmation copy does not promise paid-unit restoration or a refund', () => {
  for (const lang of ['en', 'es'] as const) {
    const a = dictionaries[lang].account
    const all = [a.deleteBody, a.deleteFree, a.deleteVsArchive, a.deleteDone, a.deleteStarted, a.deleteTitle].join(' ')
    assert.doesNotMatch(all, /refund|reembols|credit|crédito/i)
  }
  assert.match(dictionaries.en.account.deleteBody, /Paid book or subscription uses are not automatically restored\./)
  assert.match(dictionaries.es.account.deleteBody, /no se restauran automáticamente\./)
  // No unqualified promise that a paid unit comes back.
  assert.doesNotMatch(dictionaries.en.account.deleteBody, /(?<!not automatically |cannot be )restored/)
  assert.doesNotMatch(dictionaries.es.account.deleteBody.replace('no se restauran automáticamente', ''), /restaur[ae]n/)
})

test('14. Free allowance wording stays conditional ("may"), never a promise', () => {
  assert.match(dictionaries.en.account.deleteFree, /may become available again/)
  assert.doesNotMatch(dictionaries.en.account.deleteFree, /\bwill\b/)
  assert.match(dictionaries.es.account.deleteFree, /puede volver a estar disponible/)
  assert.doesNotMatch(dictionaries.es.account.deleteFree, /volverá|será/)
  // Matches the Terms wording (3C-8): "may become available again" / "puede volver a estar disponible".
  assert.match(read('lib/i18n/legal.ts'), /that Free book may become available again/)
  assert.match(read('lib/i18n/legal.ts'), /ese libro Free puede volver a estar disponible/)
})

// ── Request behaviour (15-17) ───────────────────────────────────────────────

test('15. confirm sends exactly one DELETE to /api/story/[requestId]', async () => {
  const h = harness(200, { ok: true, state: 'deleted' })
  h.flow.open()
  await h.flow.confirm()
  assert.deepEqual(h.calls, [{ url: `/api/story/${STORY}`, method: 'DELETE' }])
  assert.equal(storyDeletePath('a b/../c'), '/api/story/a%20b%2F..%2Fc', 'the id is URL-encoded into one path segment')
  // The hook/components build no URL of their own: the pure module is the single sender.
  for (const f of [ACTIONS, ROW, LIST, DIALOG, HOOK]) assert.doesNotMatch(stripComments(read(f)), /method:\s*['"]DELETE['"]/, `${f} sends DELETE itself`)
  assert.equal((read(LOGIC).match(/fetchImpl\(storyDeletePath\(requestId\), \{ method: 'DELETE' \}\)/g) ?? []).length, 1, 'one fetch call site')
})

test('16. a duplicate click while pending sends no second request', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => { release = r })
  const h = harness(200, { ok: true, state: 'deleted' }, { delay: () => gate })
  h.flow.open()
  const first = h.flow.confirm()
  assert.equal(h.flow.state.phase, 'pending')
  const second = h.flow.confirm() // double click
  const third = h.flow.confirm()
  h.flow.open()   // clicking Delete again while pending
  h.flow.cancel() // Escape while pending
  assert.equal(h.flow.state.phase, 'pending', 'nothing moves the flow while the request is in flight')
  release()
  await Promise.all([first, second, third])
  assert.equal(h.calls.length, 1)
  assert.equal(h.removed.length, 1, 'the row is removed once')
  // Reducer guard, independently of the controller.
  assert.equal(deleteFlowReducer({ phase: 'pending', error: null }, { type: 'confirm' }).phase, 'pending')
  assert.equal(deleteFlowReducer({ phase: 'idle', error: null }, { type: 'confirm' }).phase, 'idle')
  // The dialog disables both controls while pending.
  const dialog = read(DIALOG)
  assert.equal((dialog.match(/disabled=\{pending\}/g) ?? []).length, 2, 'Cancel and Confirm are disabled while pending')
  assert.match(read(ACTIONS), /onClick=\{del\.open\}\s*disabled=\{busy \|\| del\.pending\}/, 'the Delete trigger is disabled while pending or while Restore is in flight')
})

test('17. Restore is not actionable while the delete request is pending (and Delete not while Restore is in flight)', () => {
  const src = stripComments(read(ACTIONS))
  const restoreButton = src.slice(src.indexOf('<button'), src.indexOf('</button>'))
  assert.match(restoreButton, /onClick=\{go\}/)
  assert.match(restoreButton, /disabled=\{busy \|\| del\.pending\}/)
  assert.match(src, /async function go\(\) \{\s*if \(del\.pending\) return/, 'go() refuses to run during a deletion even if clicked programmatically')
})

// ── Response handling (18-25) ───────────────────────────────────────────────

test('18. 200 removes the story and shows "Story deleted."', async () => {
  const h = harness(200, { ok: true, state: 'deleted' })
  h.flow.open(); await h.flow.confirm()
  assert.deepEqual(h.removed, [{ id: STORY, outcome: 'deleted' }])
  assert.deepEqual(h.flow.state, { phase: 'idle', error: null })
  assert.equal(h.unauthenticated, 0)
  assert.equal(deleteNoticeKey('deleted'), 'deleteDone')
  assert.equal(dictionaries.en.account.deleteDone, 'Story deleted.')
  assert.equal(dictionaries.es.account.deleteDone, 'Cuento eliminado.')
  // The list drops the row by id and announces the notice in a live region.
  const list = read(LIST)
  assert.match(list, /setRows\(prev => prev\.filter\(r => r\.story\.id !== requestId\)\)/)
  assert.match(list, /setNotice\(key \? a\[key\] : null\)/)
  assert.match(list, /<div role="status" aria-live="polite">/)
  assert.match(list, /onRemoved=\{handleRemoved\}/)
  // No page refresh is needed for the removal (the server list would also no longer contain the row).
  assert.match(stripComments(read(HOOK)), /onRemoved: \(id, outcome\) => removedRef\.current\(id, outcome\)/)
})

test('19. 202 removes the story and shows the cleanup-pending message', async () => {
  const h = harness(202, { ok: true, state: 'cleanup_pending', message: 'Deletion has begun. Remaining cleanup finishes automatically.' })
  h.flow.open(); await h.flow.confirm()
  assert.deepEqual(h.removed, [{ id: STORY, outcome: 'cleanup_pending' }])
  assert.deepEqual(h.flow.state, { phase: 'idle', error: null })
  assert.equal(deleteNoticeKey('cleanup_pending'), 'deleteStarted')
  assert.equal(dictionaries.en.account.deleteStarted, 'Deletion started. Remaining cleanup will finish automatically.')
  assert.equal(dictionaries.es.account.deleteStarted, 'Eliminación iniciada. La limpieza restante terminará automáticamente.')
  // A 200 whose body says cleanup_pending is treated the same way, never as complete.
  assert.equal(classifyDeleteResponse(200, { ok: true, state: 'cleanup_pending' }), 'cleanup_pending')
})

test('20. the 202 copy does not claim full completion', () => {
  for (const lang of ['en', 'es'] as const) {
    const s = dictionaries[lang].account.deleteStarted
    assert.doesNotMatch(s, /deleted\.|fully|complete|eliminado\.|por completo|completad/i)
    assert.notEqual(s, dictionaries[lang].account.deleteDone)
  }
  assert.doesNotMatch(dictionaries.en.account.deleteStarted, /\d/, 'no timing promise')
  assert.doesNotMatch(dictionaries.es.account.deleteStarted, /\d/)
})

test('21. 409 keeps the story, closes the dialog and shows the eligibility message; retry stays possible', async () => {
  const h = harness(409, { message: 'This story is not currently eligible for permanent deletion.', code: 'NOT_ELIGIBLE' })
  h.flow.open(); await h.flow.confirm()
  assert.deepEqual(h.removed, [])
  assert.deepEqual(h.flow.state, { phase: 'idle', error: 'not_eligible' })
  assert.equal(deleteNoticeKey('not_eligible'), 'deleteNotEligible')
  assert.equal(dictionaries.en.account.deleteNotEligible, 'This story is not currently eligible for permanent deletion.')
  assert.equal(dictionaries.es.account.deleteNotEligible, 'Este cuento no es elegible para eliminación permanente en este momento.')
  // Retry later: opening again clears the message and a new confirm sends a new request.
  h.flow.open()
  assert.deepEqual(h.flow.state, { phase: 'confirming', error: null })
  await h.flow.confirm()
  assert.equal(h.calls.length, 2)
  // The row shows the message as an alert next to the actions.
  assert.match(read(ACTIONS), /const deleteErrorKey = del\.error \? deleteNoticeKey\(del\.error\) : null/)
  assert.match(read(ACTIONS), /\{message && <span role="alert"/)
})

test('22. 404 removes the stale row privately ("no longer available"), with no ownership detail', async () => {
  const h = harness(404, { message: 'Story not found', code: 'NOT_FOUND' })
  h.flow.open(); await h.flow.confirm()
  assert.deepEqual(h.removed, [{ id: STORY, outcome: 'gone' }])
  assert.deepEqual(h.flow.state, { phase: 'idle', error: null })
  assert.equal(deleteNoticeKey('gone'), 'deleteGone')
  assert.equal(dictionaries.en.account.deleteGone, 'This story is no longer available.')
  assert.equal(dictionaries.es.account.deleteGone, 'Este cuento ya no está disponible.')
  for (const lang of ['en', 'es'] as const) assert.doesNotMatch(dictionaries[lang].account.deleteGone, /own|belong|another|otra|pertenec|propie/i)
  assert.equal(removesStoryRow('gone'), true)
})

test('23. 401 follows the account page\'s session handling: router.refresh() lands on redirect(\'/login\'); nothing is removed or shown', async () => {
  const h = harness(401, { message: 'Unauthorized' })
  h.flow.open(); await h.flow.confirm()
  assert.equal(h.unauthenticated, 1)
  assert.deepEqual(h.removed, [])
  assert.deepEqual(h.flow.state, { phase: 'idle', error: null })
  assert.equal(deleteNoticeKey('unauthenticated'), null)
  assert.match(stripComments(read(HOOK)), /onUnauthenticated: \(\) => refreshRef\.current\(\)/)
  assert.match(stripComments(read(HOOK)), /refreshRef\.current = router\.refresh/)
  assert.match(read(PAGE), /if \(!user\) redirect\('\/login'\)/, 'the archived page redirects an expired session on the server')
})

test('24. 500 (and a network failure) keeps the story and shows a generic message; retry stays possible', async () => {
  for (const h of [harness(500, { message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' }), harness(503, {}), harness(0, null, { throws: true })]) {
    h.flow.open(); await h.flow.confirm()
    assert.deepEqual(h.removed, [])
    assert.deepEqual(h.flow.state, { phase: 'idle', error: 'failed' })
    h.flow.open(); await h.flow.confirm()
    assert.equal(h.calls.length, 2)
  }
  assert.equal(await requestStoryDeletion(STORY, fakeFetch(0, null, { throws: true }).fn), 'failed')
  assert.equal(deleteNoticeKey('failed'), 'deleteFailed')
  assert.equal(dictionaries.en.account.deleteFailed, 'We could not delete this story right now. Please try again.')
  assert.equal(dictionaries.es.account.deleteFailed, 'No pudimos eliminar este cuento ahora. Inténtalo de nuevo.')
})

test('25. raw API details are never rendered: the body is classified by status only and copy comes from the dictionary', async () => {
  const leaky = { message: 'delete_failed_story returned complete_not_applied for log 0123', code: 'INTERNAL_ERROR', detail: 'service_role', failureCode: 'storage_remove_failed' }
  for (const [status, expected] of [[200, 'deleted'], [202, 'cleanup_pending'], [409, 'not_eligible'], [404, 'gone'], [401, 'unauthenticated'], [500, 'failed'], [418, 'failed']] as [number, DeleteStoryOutcome][]) {
    assert.equal(classifyDeleteResponse(status, leaky), expected, String(status))
    assert.equal(classifyDeleteResponse(status, 'not json'), expected)
    assert.equal(classifyDeleteResponse(status, null), expected)
  }
  // Every outcome that is shown maps to a dictionary key; the key set is closed.
  const keys = (['deleted', 'cleanup_pending', 'not_eligible', 'gone', 'failed'] as DeleteStoryOutcome[]).map(deleteNoticeKey)
  assert.deepEqual(keys, ['deleteDone', 'deleteStarted', 'deleteNotEligible', 'deleteGone', 'deleteFailed'])
  // The components render only dictionary text for deletion outcomes: no body.message, code, detail or failureCode.
  for (const f of [ACTIONS, LIST, DIALOG, HOOK]) {
    const src = stripComments(read(f))
    assert.doesNotMatch(src, /failureCode|\.detail\b|\.code\b|state\b.*message/, `${f} reads an internal field`)
  }
  // The one body.message use in StoryRowActions belongs to the pre-existing archive/restore path, not to Delete.
  const actions = stripComments(read(ACTIONS))
  assert.equal((actions.match(/body\.message/g) ?? []).length, 1)
  assert.match(actions, /const res = await fetch\(`\/api\/story\/\$\{requestId\}\/\$\{mode\}`, \{ method: 'POST' \}\)[\s\S]*?body\.message/)
  // Dictionary strings carry no internal terminology.
  for (const lang of ['en', 'es'] as const) {
    const a = dictionaries[lang].account as Record<string, unknown>
    const text = Object.entries(a).filter(([k]) => k.startsWith('delete')).map(([, v]) => String(v)).join(' ')
    assert.doesNotMatch(text, /deletion_log|delete_failed_story|complete_story_deletion|\bRPC\b|story-images|book-exports|service[ _-]role|cron|reconcil|cascade|worker|bucket|storage|quiescen|app_settings|customer_story_deletion/i)
  }
})

// ── Boundaries (26-34) ──────────────────────────────────────────────────────

test('26. no worker / quiescence logic is duplicated client-side', () => {
  for (const f of UI_FILES) {
    const src = read(f)
    assert.doesNotMatch(src, /worker_id|worker_lease|quiescen|updated_at|3[- ]?minute|three minutes|180[_ ]?000|lease_/i, `${f} reasons about workers or quiescence`)
  }
  // The rule takes only the three presentation inputs.
  assert.match(read(LOGIC), /export function canOfferStoryDeletion\(\{ enabled, status, archivedAt \}: StoryPresentation\): boolean \{\s*return enabled === true && status === 'failed' && typeof archivedAt === 'string' && archivedAt\.length > 0\s*\}/)
})

test('27. no deletion-record, storage, purchase or ownership eligibility logic in the client', () => {
  for (const f of UI_FILES) {
    const src = read(f)
    assert.doesNotMatch(src, /deletion_log|delete_failed_story|complete_story_deletion|story_purchases|consumed_request_id|release_purchase|release_free|free_books_used|story-images|book-exports|\.storage\b|\.rpc\(|user_id|supabase/i, `${f} reaches past the presentation rule`)
    assert.doesNotMatch(src, /['"]@\/lib\/supabase|createAdminClient|createClient\(/, `${f} talks to the database`)
  }
  // Client files never import the server deletion modules.
  const clientFiles = FILES.filter((p) => /\.(ts|tsx)$/.test(p) && /['"]use client['"]/.test(readFileSync(p, 'utf8').slice(0, 400)))
  for (const f of clientFiles) assert.doesNotMatch(readFileSync(f, 'utf8'), new RegExp(`${DELETION_DIR}|customerDeleteRoute|handleCustomerStoryDelete`), `${f} imports a server deletion module`)
  // The pure module imports nothing at all.
  assert.doesNotMatch(stripComments(read(LOGIC)), /^import /m)
})

test('28. no swipe or gesture behaviour was introduced; the Delete button is desktop-only (md and up)', () => {
  for (const f of UI_FILES) {
    assert.doesNotMatch(read(f), /swipe|onTouch|onPointer|touch-action|pan-y|drag|gesture|translateX|useMediaQuery|matchMedia/i, `${f} has gesture code`)
  }
  assert.match(read(ACTIONS), /className="hidden md:inline-flex[^"]*text-red-600/, 'the Delete trigger is hidden below md')
  // The row layout itself is unchanged apart from the two new props.
  const row = read(ROW)
  assert.match(row, /<div className="flex items-center gap-3 sm:gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-3\.5 sm:px-4 py-3\.5 sm:py-4 hover:border-brand-200 transition-colors">/)
})

test('29. customer_story_deletion_enabled remains OFF/unseeded: no migration, seed, admin toggle or client reference', () => {
  const refs = FILES.filter((f) => !f.endsWith('.test.ts') && readFileSync(f, 'utf8').includes('customer_story_deletion_enabled'))
  assert.deepEqual(refs.sort(), [resolve(ROOT, 'app/api/story/[requestId]/route.ts'), resolve(ROOT, DELETION_DIR, 'customerDeleteRoute.ts'), resolve(ROOT, PAGE)].sort(), `flag referenced by ${refs.join(', ')}`)
  for (const f of FILES.filter((f) => /supabase\/migrations\/.*\.sql$/.test(f))) assert.doesNotMatch(readFileSync(f, 'utf8'), /customer_story_deletion/, f)
  for (const f of FILES.filter((f) => /\/(app|components)\/admin\//.test(f))) assert.doesNotMatch(readFileSync(f, 'utf8'), /customer_story_deletion/, `${f} exposes the flag in admin UI`)
  // The page reads it; it never writes app_settings. (No file touched by 3C-4 writes settings.)
  for (const f of [PAGE, ...UI_FILES]) assert.doesNotMatch(read(f), /updateSetting|app_settings|\.insert\(|\.upsert\(|\.update\(/, `${f} writes a setting`)
  assert.match(read(PAGE), /customer_story_deletion_enabled', false\)/)
})

test('30. DELETE route unchanged', () => {
  assert.equal(sha('app/api/story/[requestId]/route.ts'), '2c546febba4d839b3d5919bb44c9f970848befa967813a01c5cb0408c3ffee39')
  assert.equal(sha(`${DELETION_DIR}/customerDeleteRoute.ts`), '602cb11306e04d1480775b7b0649a2bfbd5ef77c056a9b429dcdcb52cf4217e8')
  assert.equal(sha(`${DELETION_DIR}/deleteFailedStory.ts`), '19ae7d1812ca87c7e3436f9fb878483932a705fe747b908244d371e9be7da8ad')
})

test('31. 3C-6 sweep unchanged', () => {
  assert.equal(sha(`${DELETION_DIR}/reconcileStartedDeletions.ts`), '5c03f76721a79c4cb37db9e8fa52efb912f2e7f83b26729d50e7fdd56e61a55b')
  assert.equal(sha('app/api/cron/deletion-sweep/route.ts'), '1a77481e9d2104fb3a2329bf2a5f05dd7e0ca0455dc3e329291c5a1172adbb67')
  assert.equal(sha('vercel.json'), 'bf170f51c6a40599535816fe56445c1cc718678d088ab23d8705fc093c9e0da4')
})

test('32. 3C-8 legal text unchanged, and the UI copy makes no promise the legal text lacks', () => {
  assert.equal(sha('lib/i18n/legal.ts'), '0e4ccfae77d0ea338f539c24df85ef0f878a1d7c0832301bb44e75b42eea9e2c')
  const legal = read('lib/i18n/legal.ts')
  // archive != deletion; irreversible; account remains; paid units not automatically restored; Free may return; asynchronous clean-up.
  assert.match(legal, /Permanent deletion is a separate action/)
  assert.match(legal, /A permanently deleted story cannot be restored/)
  assert.match(legal, /Deleting a story does not close your account/)
  assert.match(legal, /does not restore a book used from a purchase or subscription period/)
  assert.match(legal, /the Service retries it automatically/)
  for (const lang of ['en', 'es'] as const) {
    const a = dictionaries[lang].account
    const all = [a.deleteBody, a.deleteFree, a.deleteVsArchive, a.deleteDone, a.deleteStarted, a.deleteNotEligible, a.deleteGone, a.deleteFailed].join(' ')
    assert.doesNotMatch(all, /backup|respaldo|immediately|inmediat|instant|within \d|en \d|minutes|minutos|hours|horas|days|días/i, `${lang} copy promises timing or backup erasure`)
  }
})

test('33. no migration added', () => {
  assert.equal(readdirSync(resolve(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort().at(-1), '20240075_deletion_count_durability.sql')
  for (const m of ['20240073_deletion_schema_foundation.sql', '20240074_failed_story_deletion.sql', '20240075_deletion_count_durability.sql']) {
    assert.ok(statSync(resolve(ROOT, 'supabase/migrations', m)).isFile())
  }
})

test('34. no production setting change: nothing in the repository seeds, enables or toggles the flag, and the UI only reads a boolean prop', () => {
  for (const f of FILES) {
    if (f.endsWith('.test.ts')) continue
    const src = readFileSync(f, 'utf8')
    if (!/customer_story_deletion/.test(src)) continue
    assert.doesNotMatch(src, /customer_story_deletion_enabled['"]?\s*[,:]\s*true|value:\s*true|INSERT|insert\(|upsert\(|updateSetting/i, `${f} enables the flag`)
  }
  // The prop chain carries a boolean only, defaulting to false at every hop.
  assert.match(read(LIST), /deletionEnabled\?: boolean/)
  assert.match(read(ROW), /deletionEnabled\?: boolean/)
  assert.match(read(ACTIONS), /deletable\?: boolean/)
  assert.match(read(LIST), /deletionEnabled=\{deletionEnabled\}/)
  assert.match(read(ROW), /deletable=\{deletable\}/)
})

// ── Accessibility pins (spec <accessibility>) ───────────────────────────────

test('A11y. explicit labels, dialog semantics, text-distinguishable confirm, focus trap, keyboard cancel, announced pending state', () => {
  const dialog = read(DIALOG)
  assert.match(dialog, /role="dialog"/)
  assert.match(dialog, /aria-modal="true"/)
  assert.match(dialog, /aria-labelledby=\{titleId\}/)
  assert.match(dialog, /aria-describedby=\{descId\}/)
  assert.match(dialog, /<h2 id=\{titleId\}[^>]*>\{a\.deleteTitle\}<\/h2>/)
  assert.match(dialog, /role="status" aria-live="polite"[^>]*>\s*\{pending \? a\.deletePending : ''\}/, 'the pending state is announced as text')
  assert.match(dialog, /\{pending \? a\.deletePending : a\.deleteConfirm\}/, 'the confirm button text changes while pending')
  assert.match(dialog, /e\.key === 'Tab'/, 'Tab is trapped inside the dialog')
  assert.match(dialog, /aria-busy=\{pending \|\| undefined\}/)
  const actions = read(ACTIONS)
  assert.match(actions, /\{del\.pending \? a\.deletePending : a\.deleteForever\}/, 'the trigger reads "Deleting…" while pending')
  assert.match(actions, /role="alert"/)
  // Confirm and Cancel differ by text in both languages, not by colour alone.
  for (const lang of ['en', 'es'] as const) {
    assert.notEqual(dictionaries[lang].account.deleteConfirm, dictionaries[lang].account.deleteCancel)
    assert.match(dictionaries[lang].account.deleteConfirm, /permanent/i)
  }
})
