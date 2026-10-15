/**
 * Privacy Foundation 2 policy tests: parent / guardian authorization.
 *
 * Pins the founder decision of 2026-10-15: a story cannot be submitted
 * without an explicit, un-pre-checked affirmation that the user is an
 * adult with authority to share the child's (and anyone else's)
 * information; the server enforces it before anything irreversible; the
 * evidence is stored on the row; historical rows are never backfilled;
 * and Privacy Foundation 1 (no IP / geo) stays intact.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  checkAdultAuthorization,
  adultAuthorizationEvidence,
  ADULT_AUTHORIZATION_FIELD,
  ADULT_AUTHORIZATION_VERSION,
  ADULT_AUTHORIZATION_ERROR_CODE,
} from './adultAuthorization.ts'
import { buildStoryFormSchema, STORY_FORM_MESSAGES_EN } from '../validators/story-form.ts'
import { dictionaries } from '../i18n/index.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

const submitRoute = read('app/api/story/submit/route.ts')
const reviewStep = read('components/story/wizard/steps/ReviewStep.tsx')
const wizard = read('components/story/wizard/StoryWizard.tsx')
const migration = read('supabase/migrations/20240072_story_requests_adult_authorization.sql')
const dbTypes = read('types/database.ts')
const adminStoryDetail = read('app/admin/stories/[requestId]/page.tsx')

/** A complete, valid Free-book submission as the wizard sends it. */
const VALID_FORM = {
  planTier: 'free',
  childName: 'Theo',
  childAge: 5,
  storyTheme: 'A brave rabbit who learns to share',
  storyTone: ['adventurous'],
  storyLength: 8,
  illustrationStyle: 'watercolor',
  supportingCharacters: 'His little sister Mia and Grandpa Joe',
  userEmail: 'parent@example.com',
  adultAuthorizationConfirmed: true,
}

// 1. The checkbox is not pre-checked.
test('1. the affirmation checkbox is never pre-checked', () => {
  // The form has no default for the field...
  const defaults = wizard.match(/defaultValues: \{([\s\S]*?)\n    \},/)
  assert.ok(defaults, 'wizard declares defaultValues')
  assert.doesNotMatch(defaults![1], /adultAuthorizationConfirmed/, 'no default value for the affirmation')
  // ...and the input itself carries no checked/defaultChecked attribute.
  const input = reviewStep.match(/<input\s+id="adult-authorization"[\s\S]*?\/>/)
  assert.ok(input, 'review step renders the affirmation checkbox')
  assert.match(input![0], /type="checkbox"/)
  assert.doesNotMatch(input![0], /\bdefaultChecked\b|\bchecked\b/, 'checkbox is rendered unchecked')
  assert.match(input![0], /\{\.\.\.register\('adultAuthorizationConfirmed'\)\}/, 'checkbox is the form field')
  // A restored Stripe-checkout draft never re-ticks it.
  assert.match(wizard, /delete draft\.adultAuthorizationConfirmed/, 'checkout draft restore drops the affirmation')
})

// 2. The client schema blocks submission when the box is unchecked.
test('2. the wizard schema refuses an unchecked or missing affirmation with the localized message', () => {
  const en = buildStoryFormSchema(STORY_FORM_MESSAGES_EN)
  const es = buildStoryFormSchema(dictionaries.es.validation)
  const { adultAuthorizationConfirmed: _omit, ...withoutField } = VALID_FORM
  void _omit
  for (const [label, form] of [
    ['missing', withoutField],
    ['false', { ...VALID_FORM, adultAuthorizationConfirmed: false }],
    ['string "true"', { ...VALID_FORM, adultAuthorizationConfirmed: 'true' }],
  ] as const) {
    const r = en.safeParse(form)
    assert.equal(r.success, false, `${label}: rejected`)
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path[0] === 'adultAuthorizationConfirmed')
      assert.ok(issue, `${label}: issue is on the affirmation field`)
      assert.equal(issue!.message, STORY_FORM_MESSAGES_EN.adultAuthorization)
    }
    const rs = es.safeParse(form)
    assert.equal(rs.success, false)
    if (!rs.success) {
      const issue = rs.error.issues.find(i => i.path[0] === 'adultAuthorizationConfirmed')
      assert.equal(issue!.message, dictionaries.es.validation.adultAuthorization)
    }
  }
  assert.equal(en.safeParse(VALID_FORM).success, true, 'the same form with the box ticked is valid')
  // The submit button's step validates the field and the error renders by the box.
  assert.match(wizard, /\['userEmail', 'adultAuthorizationConfirmed'\],/)
  assert.match(reviewStep, /errors\.adultAuthorizationConfirmed\.message/)
  assert.match(reviewStep, /role="alert"/)
})

// 3-4. The server rejects a missing or false affirmation with a 4xx.
test('3-4. server check rejects missing, false and forged values with a 400 and accepts only boolean true', () => {
  for (const body of [
    undefined, null, 'x', 42, {}, [],
    { [ADULT_AUTHORIZATION_FIELD]: false },
    { [ADULT_AUTHORIZATION_FIELD]: null },
    { [ADULT_AUTHORIZATION_FIELD]: 'true' },
    { [ADULT_AUTHORIZATION_FIELD]: 1 },
    { [ADULT_AUTHORIZATION_FIELD]: 'yes' },
    { [ADULT_AUTHORIZATION_FIELD]: {} },
    { [ADULT_AUTHORIZATION_FIELD]: [true] },
    { adultConsent: true },
  ]) {
    const r = checkAdultAuthorization(body)
    assert.equal(r.ok, false, `rejected: ${JSON.stringify(body)}`)
    if (!r.ok) {
      assert.equal(r.status, 400)
      assert.equal(r.code, ADULT_AUTHORIZATION_ERROR_CODE)
      assert.ok(r.message.length > 0)
    }
  }
  assert.deepEqual(checkAdultAuthorization({ [ADULT_AUTHORIZATION_FIELD]: true }), { ok: true })
  assert.deepEqual(checkAdultAuthorization(VALID_FORM), { ok: true })
  // The route returns the check's status, never a thrown Error (which toApiError maps to 500).
  assert.match(submitRoute, /const authorization = checkAdultAuthorization\(body\)/)
  assert.match(submitRoute, /\{ message: authorization\.message, code: authorization\.code \},\s*\{ status: authorization\.status \}/)
  // And the wizard has a localized line for the code in both languages.
  assert.ok(dictionaries.en.wizard.errors.codes[ADULT_AUTHORIZATION_ERROR_CODE])
  assert.ok(dictionaries.es.wizard.errors.codes[ADULT_AUTHORIZATION_ERROR_CODE])
})

// 5-6. Rejection happens before anything is consumed or written.
test('5-6. the server check runs before identity, rate limits, idempotency, entitlement reservation and the insert', () => {
  const at = (needle: string | RegExp) => {
    const i = typeof needle === 'string' ? submitRoute.indexOf(needle) : submitRoute.search(needle)
    assert.ok(i >= 0, `route contains ${needle}`)
    return i
  }
  const check = at('checkAdultAuthorization(body)')
  assert.ok(check > at('const body = await request.json()'), 'checked on the parsed body')
  for (const later of [
    'validateStoryForm(body)',
    'supabase.auth.getUser()',
    'gateGuestStoryCreation(',
    'checkStoryRateLimit(',
    'checkQueueGate(',
    'reserveIdempotencyKey(',
    'reserveEntitlement(',
    ".from('story_requests')",
    '.insert({',
    'triggerProcessingPipeline(requestId',
    'sendSubmissionConfirmationEmail(',
  ]) {
    assert.ok(check < at(later), `affirmation check precedes ${later}`)
  }
  // Only one story insert exists on this path and it comes after the check.
  assert.equal(submitRoute.split(".from('story_requests')").length - 1, 1)
})

// 7-8. The check does not depend on who is submitting.
test('7-8. a valid affirmation passes for guests and account holders alike', () => {
  // The check reads only the body; the user is identified afterwards.
  assert.ok(submitRoute.indexOf('checkAdultAuthorization(body)') < submitRoute.indexOf('supabase.auth.getUser()'))
  assert.doesNotMatch(submitRoute.slice(0, submitRoute.indexOf('checkAdultAuthorization(body)')), /auth\.getUser|guest_token/)
  const src = read('lib/story/adultAuthorization.ts')
  assert.doesNotMatch(src, /^import /m, 'the check module is dependency-free and reads nothing but the body')
  assert.deepEqual(checkAdultAuthorization({ ...VALID_FORM }), { ok: true })
  assert.deepEqual(checkAdultAuthorization({ ...VALID_FORM, userEmail: 'guest@example.com' }), { ok: true })
})

// 9. Evidence is persisted with the row: TRUE, server timestamp, wording version.
test('9. the story insert carries the affirmation evidence and nothing else about the person', () => {
  const insert = submitRoute.slice(submitRoute.indexOf('.insert({'), submitRoute.indexOf(".select('id')"))
  assert.match(insert, /\.\.\.adultAuthorizationEvidence\(\)/)
  const ev = adultAuthorizationEvidence(new Date('2026-10-15T12:34:56.000Z'))
  assert.deepEqual(ev, {
    adult_authorization_confirmed: true,
    adult_authorization_confirmed_at: '2026-10-15T12:34:56.000Z',
    adult_authorization_version: ADULT_AUTHORIZATION_VERSION,
  })
  assert.match(ADULT_AUTHORIZATION_VERSION, /^\d{4}-\d{2}-\d{2}/, 'wording version is date-stamped')
  assert.deepEqual(Object.keys(ev).sort(), [
    'adult_authorization_confirmed', 'adult_authorization_confirmed_at', 'adult_authorization_version',
  ])
  // The timestamp is the server clock: the client cannot supply it.
  assert.doesNotMatch(insert, /body\.adult_authorization|formData\.adultAuthorization/)
  // Typed on the row.
  for (const col of ['adult_authorization_confirmed', 'adult_authorization_confirmed_at', 'adult_authorization_version']) {
    assert.match(dbTypes, new RegExp(`^\\s*${col}:`, 'm'), `StoryRequest declares ${col}`)
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\s`), `migration adds ${col}`)
  }
})

// 10. Historical rows are not falsely backfilled.
test('10. migration 20240072 adds nullable columns, never backfills, and only allows TRUE-with-evidence or NULL', () => {
  assert.doesNotMatch(migration, /UPDATE\s+public\.story_requests/i, 'no UPDATE of existing rows')
  assert.doesNotMatch(migration, /DEFAULT\s+TRUE/i, 'no DEFAULT TRUE')
  assert.doesNotMatch(migration, /adult_authorization_confirmed\s+BOOLEAN\s+NOT NULL/i, 'column stays nullable for historical rows')
  assert.doesNotMatch(migration, /DELETE\s+FROM|DROP\s+COLUMN/i)
  assert.match(migration, /adult_authorization_confirmed IS NULL/)
  assert.match(migration, /adult_authorization_confirmed = TRUE\s+AND adult_authorization_confirmed_at IS NOT NULL\s+AND adult_authorization_version IS NOT NULL/)
  // Forward-only: earlier migrations are untouched.
  assert.match(read('supabase/migrations/20240071_story_requests_drop_ip_geo.sql'), /DROP COLUMN IF EXISTS ip_address/)
  // The type says what NULL means, so nobody reads it as "declined".
  assert.match(dbTypes, /adult_authorization_confirmed: boolean \| null/)
})

// 11-12. English and Spanish wording render on the review step.
test('11-12. EN and ES affirmation wording exist, say what the founder decided, and reach the review step', () => {
  const en = dictionaries.en.wizard.review
  const es = dictionaries.es.wizard.review
  assert.match(en.authorizationLabel, /I confirm that I am an adult/)
  assert.match(en.authorizationLabel, /parent or legal guardian/)
  assert.match(en.authorizationLabel, /permission from the child's parent or legal guardian/)
  assert.match(en.authorizationLabel, /any other people included in this story/)
  assert.match(es.authorizationLabel, /Confirmo que soy una persona adulta/)
  assert.match(es.authorizationLabel, /tutor legal/)
  assert.match(es.authorizationLabel, /cualquier otra persona incluida en este cuento/)
  assert.notEqual(en.authorizationLabel, es.authorizationLabel)
  assert.ok(en.authorizationHeading && es.authorizationHeading)
  assert.match(reviewStep, /\{r\.authorizationLabel\}/)
  assert.match(reviewStep, /\{r\.authorizationHeading\}/)
  // No legal over-claims anywhere in the user-facing or stored wording.
  for (const text of [en.authorizationLabel, es.authorizationLabel, en.authorizationHeading, es.authorizationHeading,
    dictionaries.en.validation.adultAuthorization, dictionaries.es.validation.adultAuthorization,
    dictionaries.en.wizard.errors.codes[ADULT_AUTHORIZATION_ERROR_CODE], dictionaries.es.wizard.errors.codes[ADULT_AUTHORIZATION_ERROR_CODE]]) {
    assert.doesNotMatch(text, /COPPA|verifiable|verif|legally binding|certif/i, `no legal claim in: ${text}`)
  }
  // Accessible label/checkbox relationship.
  assert.match(reviewStep, /<label htmlFor="adult-authorization"/)
  assert.match(reviewStep, /aria-describedby=\{errors\.adultAuthorizationConfirmed \? 'adult-authorization-error'/)
  assert.match(reviewStep, /id="adult-authorization-error"/)
})

// 13. The affirmation sits on the review step, right above the submit button, not in a modal.
test('13. placement: review step, directly before the Create button, outside any modal', () => {
  const emailIdx = reviewStep.indexOf("register('userEmail')")
  const boxIdx = reviewStep.indexOf("register('adultAuthorizationConfirmed')")
  assert.ok(emailIdx > 0 && boxIdx > emailIdx, 'checkbox follows the email field at the end of the review step')
  assert.doesNotMatch(reviewStep.slice(boxIdx - 1500, boxIdx), /role="dialog"|fixed inset-0/, 'not inside a modal')
  // The review step is the last step and its card renders immediately above the submit button.
  assert.match(wizard, /const STANDARD_STEPS = \[PlanStep, ChildStep, StoryStep, StyleStep, ReviewStep\]/)
  assert.match(wizard, /data-tour-id="submit-button"/)
})

// 14. Privacy Foundation 1 stays intact.
test('14. no IP / geo field reappears with the affirmation', () => {
  // Comments explain what is deliberately NOT stored; strip them and check the code.
  const stripComments = (src: string) => src.replace(/^\s*--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const src of [migration, submitRoute, read('lib/story/adultAuthorization.ts'), reviewStep]) {
    assert.doesNotMatch(stripComments(src), /\bip_address\b|\bgeo_(city|region|country)\b|x-vercel-ip|birth|date_of_birth|government/i)
  }
  assert.doesNotMatch(migration, /ADD COLUMN[^;]*(ip_|geo_|birth)/i, 'migration adds only the three affirmation columns')
  // The route still reads the client IP only for the hashed rate-limit log.
  assert.equal((submitRoute.match(/x-forwarded-for/g) ?? []).length, 1)
})

// Admin: minimal indicator, historical rows read as "not collected".
test('admin story detail shows the affirmation state without inventing one for historical rows', () => {
  assert.match(adminStoryDetail, /label="Adult authorization"/)
  assert.match(adminStoryDetail, /req\.adult_authorization_confirmed\s*\?/)
  assert.match(adminStoryDetail, /Not collected/)
})
