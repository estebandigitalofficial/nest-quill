/**
 * Explicit child reference selection (2026-10-20), app side.
 *
 * Pins the contract: four explicit options and no "let the story decide";
 * the wizard requires a choice and never defaults or infers it; the choice
 * is stored as a labelled custom_notes line the worker parses (no schema
 * change); the worker-side copy of the contract is identical; EN and ES
 * copy exist; and historical rows are never assigned a selection.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CHILD_REFERENCES,
  CHILD_REFERENCE_LINE_LABEL,
  CHILD_REFERENCE_TOKENS,
  isChildReference,
  parseChildReferenceToken,
  synthesizeChildReferenceLine,
} from './childReference.ts'
import * as worker from '../../supabase/functions/process-story/childReference.ts'
import { parsePersonalization } from '../../supabase/functions/process-story/prompt.ts'
import { buildStoryFormSchema, STORY_FORM_MESSAGES_EN } from '../validators/story-form.ts'
import { mergeIntoCustomNotes, synthesizeTraitsLine } from '../services/storyFormSynthesis.ts'
import { dictionaries } from '../i18n/index.ts'

const ROOT = resolve(import.meta.dirname, '../..')
const src = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

const VALID_FORM = {
  planTier: 'free',
  childName: 'Theo',
  childAge: 5,
  childReference: 'name_only',
  storyTheme: 'A brave rabbit who learns to share',
  storyTone: ['adventurous'],
  storyLength: 8,
  illustrationStyle: 'watercolor',
  userEmail: 'parent@example.com',
  adultAuthorizationConfirmed: true,
}

test('1. exactly four explicit options; no "let the story decide" anywhere in the contract or the copy', () => {
  assert.deepEqual(CHILD_REFERENCES, ['he_him', 'she_her', 'they_them', 'name_only'])
  for (const lang of ['en', 'es'] as const) {
    const opts = dictionaries[lang].wizard.child.reference.options
    assert.deepEqual(Object.keys(opts), [...CHILD_REFERENCES])
    for (const v of Object.values(opts)) assert.ok(v.trim().length > 0)
    const all = JSON.stringify(dictionaries[lang]).toLowerCase()
    assert.doesNotMatch(all, /let the story decide|que el cuento decida|decida la historia|dejar que/)
  }
  assert.equal(dictionaries.en.wizard.child.reference.options.name_only, "Use the child's name instead")
  assert.deepEqual(dictionaries.es.wizard.child.reference.options, { he_him: 'Él', she_her: 'Ella', they_them: 'Elle (neutro)', name_only: 'Usar solo su nombre' })
  assert.match(dictionaries.en.wizard.child.reference.label, /^How should we refer to \{name\} in the story\?$/)
  assert.match(dictionaries.es.wizard.child.reference.label, /\{name\}/)
  assert.ok(dictionaries.en.wizard.review.labels.reference && dictionaries.es.wizard.review.labels.reference)
})

test('2. the wizard schema requires a choice (EN and ES messages) and refuses anything outside the four values', () => {
  const en = buildStoryFormSchema(STORY_FORM_MESSAGES_EN)
  const es = buildStoryFormSchema(dictionaries.es.validation)
  assert.equal(en.safeParse(VALID_FORM).success, true)
  for (const ref of CHILD_REFERENCES) assert.equal(en.safeParse({ ...VALID_FORM, childReference: ref }).success, true, ref)
  const { childReference: _omit, ...missing } = VALID_FORM
  void _omit
  for (const [label, form] of [['missing', missing], ['boy', { ...VALID_FORM, childReference: 'boy' }], ['empty', { ...VALID_FORM, childReference: '' }], ['decide', { ...VALID_FORM, childReference: 'let_story_decide' }]] as const) {
    const r = en.safeParse(form)
    assert.equal(r.success, false, label)
    if (!r.success) assert.equal(r.error.issues.find(i => i.path[0] === 'childReference')!.message, STORY_FORM_MESSAGES_EN.childReference)
    const rs = es.safeParse(form)
    assert.equal(rs.success, false, label)
    if (!rs.success) assert.equal(rs.error.issues.find(i => i.path[0] === 'childReference')!.message, dictionaries.es.validation.childReference)
  }
})

test('3. the wizard never pre-selects or derives the choice: no default in the form, the child step validates it, the review shows it', () => {
  const wizard = src('components/story/wizard/StoryWizard.tsx')
  assert.doesNotMatch(wizard, /childReference:\s*['"]/, 'no default value')
  assert.match(wizard, /\['childName', 'childAge', 'childReference'\],/)
  const child = src('components/story/wizard/steps/ChildStep.tsx')
  assert.match(child, /CHILD_REFERENCES\.map\(/)
  assert.match(child, /role="radiogroup"/)
  assert.match(child, /errors\.childReference\?\.message/)
  assert.match(child, /c\.reference\.options\[reference\]/)
  assert.doesNotMatch(child, /childName\.(match|test|endsWith)|\/a\$\/|\/o\$\//, 'nothing reads the name to guess')
  assert.match(src('components/story/wizard/steps/ReviewStep.tsx'), /r\.labels\.reference/)
  // drafts and resumed flows: a restored checkout draft without the choice lands on the child
  // step, and a submit whose error lives on an earlier step jumps there instead of failing silently
  assert.match(wizard, /isChildReference\(draft\.childReference\) \? \(learning \? LEARNING_STEPS : STANDARD_STEPS\)\.length - 1 : 1/)
  assert.match(wizard, /handleSubmit\(onSubmit, onInvalid\)/)
  assert.match(wizard, /STEP_FIELDS\.findIndex\(fields => fields\.some\(f => bad\.has\(f\)\)\)/)
  assert.doesNotMatch(src('components/story/wizard/steps/ReviewStep.tsx'), /errors\.childReference/, 'the review step does not render that field, so the jump is what makes the error visible')
})

test('4. storage: the choice is one labelled custom_notes line, first, round-tripping through the worker parser; legacy forms write nothing', () => {
  for (const ref of CHILD_REFERENCES) {
    const line = synthesizeChildReferenceLine(ref)!
    assert.equal(line, `${CHILD_REFERENCE_LINE_LABEL}: ${CHILD_REFERENCE_TOKENS[ref]}`)
    assert.equal(parseChildReferenceToken(CHILD_REFERENCE_TOKENS[ref]), ref)
    const notes = mergeIntoCustomNotes('Loves trains.', [line, synthesizeTraitsLine(['brave'], null)])!
    assert.equal(notes.split('\n')[0], line)
    const parsed = parsePersonalization(notes)
    assert.equal(parsed.reference, ref)
    assert.equal(parsed.traits, 'brave')
    assert.equal(parsed.notes, 'Loves trains.')
  }
  assert.equal(synthesizeChildReferenceLine(undefined), null)
  assert.equal(synthesizeChildReferenceLine('boy'), null)
  assert.equal(isChildReference('she_her'), true)
  assert.equal(isChildReference('girl'), false)
  // the DB limit is untouched and the line is cheap: the parent's note is what gives way, never the selection
  const long = 'x'.repeat(700)
  const notes = mergeIntoCustomNotes(long, [synthesizeChildReferenceLine('they_them')])!
  assert.ok(notes.length <= 600)
  assert.equal(parsePersonalization(notes).reference, 'they_them')
  const route = src('app/api/story/submit/route.ts')
  assert.match(route, /synthesizeChildReferenceLine\(formData\.childReference\)/)
  assert.match(route, /\[referenceLine, traitsLine, \.\.\.structureLines\]/)
  assert.match(route, /childReference: formData\.childReference,/, 'two submissions differing only in the reference are different submissions')
  assert.doesNotMatch(route, /child_reference:/, 'no new column is written')
})

test('5. the worker carries an identical copy of the contract (the Edge Function cannot import lib/)', () => {
  assert.deepEqual(worker.CHILD_REFERENCES, CHILD_REFERENCES)
  assert.deepEqual(worker.CHILD_REFERENCE_TOKENS, CHILD_REFERENCE_TOKENS)
  assert.equal(worker.CHILD_REFERENCE_LINE_LABEL, CHILD_REFERENCE_LINE_LABEL)
  for (const v of ['he/him', 'SHE/HER', ' they/them ', 'name only', 'boy', '']) assert.equal(worker.parseChildReferenceToken(v), parseChildReferenceToken(v), v)
})

test('6. historical records: no migration, no backfill, and a row without the line parses to null', () => {
  assert.equal(parsePersonalization(null).reference, null)
  assert.equal(parsePersonalization('Character traits: brave\nLoves trains.').reference, null)
  assert.equal(parsePersonalization('Main character is brave.').reference, null)
  assert.equal(readdirSync(resolve(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort().at(-1), '20240075_deletion_count_durability.sql')
  assert.doesNotMatch(src('lib/story/childReference.ts'), /from '@\//, 'importable by the Node test runner')
})
