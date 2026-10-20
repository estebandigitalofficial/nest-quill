// Run: node --experimental-strip-types --test supabase/functions/process-story/childReference.test.ts
//
// Explicit child reference selection (2026-10-20), worker side: the parsed
// selection drives the text prompts and the illustration anchors; a row
// without a selection is byte-for-byte unchanged.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHILD_REFERENCES, CHILD_REFERENCE_TOKENS, childReferenceInstruction, parseChildReferenceToken, pronounTag } from './childReference.ts'
import { buildBookPrompt, buildPlanPrompt, buildStoryPrompt, parsePersonalization, personalizationFieldsUsed } from './prompt.ts'
import { buildCoverPrompt, buildImagePrompt, buildVisualBible, protagonistAnchor, validateVisualBible, type VisualBible } from './visual.ts'
import { validateStoryPlan, type StoryPlan } from './plan.ts'

// ── fixtures ────────────────────────────────────────────────────────────────

const NOTE = 'Sleeps with a stuffed triceratops called Tops.'
const line = (ref: (typeof CHILD_REFERENCES)[number]) => `Refer to the child as: ${CHILD_REFERENCE_TOKENS[ref]}`

const request = (customNotes: string | null, over: Record<string, unknown> = {}) => ({
  child_name: 'Sofia',
  child_age: 5,
  child_description: 'Loves dinosaurs, curly brown hair and glasses',
  story_theme: 'A story set in an underwater adventure beneath the waves.',
  story_tone: ['magical'],
  story_moral: null,
  story_length: 8,
  illustration_style: 'watercolor',
  dedication_text: null,
  supporting_characters: 'little brother Mateo',
  custom_notes: customNotes,
  learning_mode: false,
  ...over,
})

function makePlan(): StoryPlan {
  const pages = Array.from({ length: 8 }, (_, i) => ({
    page: i + 1,
    phase: i === 0 ? 'setup' : i === 1 ? 'inciting' : i === 6 ? 'climax' : i === 7 ? 'resolution' : 'development',
    beat: i % 3 === 2 ? `Sofia and Mateo search pool ${i + 1} for Tops.` : `Sofia searches pool ${i + 1} for Tops.`,
    purpose: 'Advance the search.',
    development: '',
    continuity: `Tops still missing after pool ${i + 1}.`,
  }))
  const v = validateStoryPlan({
    title: 'The Triceratops Under the Tide',
    premise: "Sofia loses Tops at Grandma's beach and must brave the rock pools before the tide comes in.",
    protagonist: { name: 'Sofia', characterization: 'Curious but shy.', want: 'Tops back before dark.' },
    supporting_characters: [{ name: 'Mateo', role: 'little brother' }, { name: 'Grandma', role: 'grandmother at the beach house' }],
    setting: 'A rocky beach at low tide',
    central_conflict: 'The tide is rising.',
    goal: 'Find Tops.',
    emotional_arc: 'Worried → brave.',
    beginning_state: 'A happy beach day.',
    escalation: 'Each pool is deeper.',
    climax: 'Sofia wades into the deepest pool.',
    resolution: 'Tops is safe.',
    ending_state: 'Sofia trusts herself.',
    lesson: '',
    pages,
  }, 8)
  assert.ok(v.ok)
  return (v as { ok: true; plan: StoryPlan }).plan
}

const bible = (childReference: (typeof CHILD_REFERENCES)[number] | null | undefined) => buildVisualBible({
  requestId: '7d2c1e1a-0000-4000-8000-000000000001',
  childName: 'Sofia',
  childAge: 5,
  childDescription: 'Loves dinosaurs, curly brown hair and glasses',
  supportingCharactersText: 'little brother Mateo',
  customNotes: NOTE,
  childReference,
  illustrationStyle: 'watercolor',
  styleHint: 'soft watercolor illustration',
  plan: makePlan(),
})

const SAFETY = 'Child-safe, no text in image.'
const all = (msgs: { role: string; content: string }[]) => msgs.map(m => m.content).join('\n')

// ── parsing ─────────────────────────────────────────────────────────────────

test('1. the labelled custom_notes line parses to exactly one of the four selections and nothing else', () => {
  for (const ref of CHILD_REFERENCES) {
    const p = parsePersonalization(`${line(ref)}\nCharacter traits: curious\n${NOTE}`)
    assert.equal(p.reference, ref)
    assert.equal(p.traits, 'curious')
    assert.equal(p.notes, NOTE, 'the reference line never leaks into the family notes')
  }
  assert.equal(parsePersonalization(`refer to the child as: SHE/HER\n${NOTE}`).reference, 'she_her', 'case-insensitive')
  // unknown values are not guessed at: they stay ordinary note text
  const odd = parsePersonalization(`Refer to the child as: the captain\n${NOTE}`)
  assert.equal(odd.reference, null)
  assert.equal(odd.notes, `Refer to the child as: the captain ${NOTE}`)
  assert.equal(parseChildReferenceToken('boy'), null)
  assert.equal(parseChildReferenceToken('he/him'), 'he_him')
  assert.deepEqual(personalizationFieldsUsed(request(line('they_them'))).includes('child_reference'), true)
  assert.deepEqual(personalizationFieldsUsed(request(NOTE)).includes('child_reference'), false)
})

// ── text prompts ────────────────────────────────────────────────────────────

test('2. each selection reaches the plan, book and single-pass prompts as a fact, a rule and an image_description rule (English)', () => {
  const plan = makePlan()
  const expect: Record<string, RegExp> = {
    he_him: /with he\/him pronouns/,
    she_her: /with she\/her pronouns/,
    they_them: /with they\/them pronouns \(singular "they"/,
    name_only: /by name only: never he, she or they for Sofia/,
  }
  for (const ref of CHILD_REFERENCES) {
    const req = request(line(ref))
    for (const msgs of [buildPlanPrompt(req), buildBookPrompt(req, plan), buildStoryPrompt(req)]) {
      const text = all(msgs)
      assert.match(text, /Refer to Sofia as: /)
      assert.match(text, /Child reference: the family chose how Sofia is referred to/)
      assert.match(text, expect[ref])
      assert.match(text, /never infer different pronouns or a gender from the name/)
      assert.match(text, /never add gender-typed hair, clothing or features/)
      assert.match(text, /In every image_description call the child "Sofia" by name/)
      assert.match(text, /never as "a boy" or "a girl"/)
    }
    assert.match(all(buildBookPrompt(req, plan)), /Refer to Sofia as: (he\/him|she\/her|they\/them|by name only \(no pronouns\))/)
  }
  // name only: the prompt says how to keep prose natural, not just what to avoid
  const nameOnly = all(buildBookPrompt(request(line('name_only')), plan))
  assert.match(nameOnly, /use the name at most once per sentence/)
  assert.match(nameOnly, /never substitute "the child", "the boy", "the girl"/)
  assert.match(nameOnly, /never with a pronoun/)
})

test('3. Spanish books get Spanish grammar guidance (agreement, "elle", invariable adjectives), never a bare pronoun swap', () => {
  const plan = makePlan()
  const es = (ref: (typeof CHILD_REFERENCES)[number]) => all(buildBookPrompt(request(line(ref)), plan, {}, 'es'))
  assert.match(es('he_him'), /pronoun "él" and masculine agreement/)
  assert.match(es('she_her'), /pronoun "ella" and feminine agreement/)
  assert.match(es('they_them'), /gender-neutral pronoun "elle" and -e endings/)
  assert.match(es('they_them'), /never "él" or "ella"/)
  assert.match(es('name_only'), /never "él", "ella" or "elle" for Sofia/)
  assert.match(es('name_only'), /invariable forms \("feliz", "valiente"/)
  assert.match(es('name_only'), /"tener", "sentir" or "estar" plus a noun/)
  // the Spanish language requirement itself is untouched
  assert.match(es('she_her'), /LANGUAGE REQUIREMENT: You MUST write the entire story/)
})

test('4. no selection = no instruction: historical rows and legacy clients get exactly the prompts they always got, and the name never implies a pronoun', () => {
  const plan = makePlan()
  for (const name of ['Sofia', 'Mateo', 'Alex', 'Guadalupe']) {
    const req = request(`Character traits: curious\n${NOTE}`, { child_name: name })
    for (const msgs of [buildPlanPrompt(req), buildBookPrompt(req, plan), buildStoryPrompt(req), buildBookPrompt(req, plan, {}, 'es')]) {
      const text = all(msgs)
      assert.doesNotMatch(text, /Refer to /)
      assert.doesNotMatch(text, /Child reference:/)
      assert.doesNotMatch(text, /\b(he\/him|she\/her|they\/them)\b/)
      assert.doesNotMatch(text, /"él"|"ella"|"elle"/)
    }
  }
  // the whole instruction is driven by the selection alone: Sofia + he/him is he/him, Mateo + she/her is she/her
  assert.match(all(buildBookPrompt(request(line('he_him')), plan)), /with he\/him pronouns/)
  assert.match(all(buildBookPrompt(request(line('she_her'), { child_name: 'Mateo' }), plan)), /the family chose how Mateo is referred to — with she\/her pronouns/)
  // the child_description is never consulted for pronouns either
  const described = request(NOTE, { child_description: 'a girl with curly hair who loves dinosaurs' })
  assert.doesNotMatch(all(buildBookPrompt(described, plan)), /Child reference:/)
})

test('5. the selection is about pronouns only: appearance facts in the prompt are unchanged by it', () => {
  const plan = makePlan()
  const facts = (ref: (typeof CHILD_REFERENCES)[number] | null) => {
    const user = buildBookPrompt(request(ref ? `${line(ref)}\n${NOTE}` : NOTE), plan)[1].content
    return user.split('\n').filter(l => /^About Sofia:|^Supporting characters:|^Hero:/.test(l))
  }
  const base = facts(null)
  for (const ref of CHILD_REFERENCES) assert.deepEqual(facts(ref), base)
})

// ── illustration prompts ────────────────────────────────────────────────────

test('6. the protagonist anchor carries the pronoun tag (or name-only rule) and the no-invented-gender rule only when a selection exists', () => {
  const plain = protagonistAnchor(bible(null))
  assert.equal(plain, protagonistAnchor(bible(undefined)))
  assert.doesNotMatch(plain, /\((he|she|they)\//)
  assert.doesNotMatch(plain, /gender-typed/)
  assert.doesNotMatch(plain, /\b(boy|girl)\b/)
  for (const ref of CHILD_REFERENCES) {
    const a = protagonistAnchor(bible(ref))
    assert.match(a, new RegExp(`^Sofia${pronounTag(ref).replace(/[()/]/g, '\\$&')} is a 5-year-old child with curly brown hair, glasses wearing `))
    assert.match(a, /; keep Sofia's face, hair, build and outfit identical to every other page of this book; /, 'the continuity sentence is intact')
    assert.match(a, /no gender-typed looks beyond those listed$/)
    // the anchor never calls the child a boy or a girl (the name-only rule only forbids it)
    assert.doesNotMatch(a.replace('never a boy or a girl', ''), /\b(boy|girl)\b/)
    assert.ok(a.length <= 320, `anchor fits the first prompt rung unclipped (${a.length})`)
  }
  assert.match(protagonistAnchor(bible('name_only')), /^Sofia is a 5-year-old child/)
  assert.match(protagonistAnchor(bible('name_only')), /; named only, never a boy or a girl; no gender-typed looks beyond those listed$/)
  assert.equal(pronounTag('name_only'), '')
})

test('7. the per-page and cover prompts stay consistent with the selection, and a persisted bible without one is read exactly as before', () => {
  const plan = makePlan()
  const she = bible('she_her')
  const page = buildImagePrompt({ bible: she, pageNumber: 4, imageDescription: 'Sofia peers into a deep rock pool, Tops just visible.', planPage: plan.pages[3], safetySuffix: SAFETY })
  assert.match(page.prompt, /Sofia \(she\/her\) is a 5-year-old child[^.]*; no gender-typed looks beyond those listed\./, 'page anchor carried whole')
  const cover = buildCoverPrompt({ bible: she, plan, tones: ['magical'], safetySuffix: SAFETY })
  assert.match(cover.prompt, /Subject: Sofia \(she\/her\) is a 5-year-old child[^.]*; no gender-typed looks beyond those listed\./, 'cover anchor carried whole')
  assert.doesNotMatch(cover.prompt, /\b(his|her) (grandmother|brother)\b/)

  // historical bible: no `reference` key at all (as persisted before the feature)
  const legacy = JSON.parse(JSON.stringify(bible(null))) as VisualBible
  assert.equal('reference' in legacy.protagonist, false)
  assert.ok(validateVisualBible(legacy).ok)
  const legacyPage = buildImagePrompt({ bible: legacy, pageNumber: 4, imageDescription: 'Sofia peers into a deep rock pool.', planPage: plan.pages[3], safetySuffix: SAFETY })
  assert.match(legacyPage.prompt, /Sofia is a 5-year-old child with curly brown hair, glasses wearing /)
  assert.doesNotMatch(legacyPage.prompt, /\((he|she|they)\/|gender-typed|named only/)
  // the bible stays deterministic: same inputs, same output; the selection is the only difference
  assert.deepEqual(bible('they_them'), bible('they_them'))
  const { reference: _r, ...withRef } = bible('they_them').protagonist
  void _r
  assert.deepEqual(withRef, bible(null).protagonist)
})

test('8. the instruction text never leaks into a bible built from a row without a selection, and tokens are the four documented strings', () => {
  assert.deepEqual(CHILD_REFERENCES, ['he_him', 'she_her', 'they_them', 'name_only'])
  assert.deepEqual(CHILD_REFERENCE_TOKENS, { he_him: 'he/him', she_her: 'she/her', they_them: 'they/them', name_only: 'name only' })
  const i = childReferenceInstruction('Sofia', 'they_them', 'en')
  assert.equal(i.fact, 'Refer to Sofia as: they/them')
  assert.equal(JSON.stringify(bible(null)).includes('Refer to'), false)
})
