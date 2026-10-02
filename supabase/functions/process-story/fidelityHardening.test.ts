// Phase 1H.1 visual fidelity hardening — deterministic tests.
// Run: node --experimental-strip-types --test supabase/functions/process-story/fidelityHardening.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_COVER_COMPANIONS,
  SUPPORTED_BIBLE_VERSIONS,
  buildCoverPrompt,
  buildImagePrompt,
  buildVisualBible,
  findPlanPage,
  protagonistAnchor,
  relevantSupportingForCover,
  scrubUnanchoredNames,
  supportingAnchor,
  validateVisualBible,
  type VisualBible,
} from './visual.ts'
import { indefinite, parseAppearance, parseSupportingEntries, withArticle } from './appearance.ts'
import { validateStoryPlan, type StoryPlan } from './plan.ts'

const SAFETY = 'Child-safe, no text, no words in image.'

function plan(odePages: number[], premise = 'On a rainy morning Imani, her cat Mango and Grandpa Ode hunt for a lost kite along the harbour wall.'): StoryPlan {
  const pages = Array.from({ length: 8 }, (_, i) => ({
    page: i + 1, phase: i === 0 ? 'setup' : i === 1 ? 'inciting' : i === 6 ? 'climax' : i === 7 ? 'resolution' : 'development', purpose: 'x', development: '',
    beat: odePages.includes(i + 1) ? `Grandpa Ode points at the kite while Imani and Mango look.` : 'Imani and Mango search the harbour wall for the kite.',
    continuity: 'Rain continues.',
  }))
  const v = validateStoryPlan({
    title: 'Imani and the Kite Quest', premise, protagonist: { name: 'Imani', characterization: 'curious', want: 'find the kite' },
    supporting_characters: [{ name: 'Grandpa Ode', role: 'her grandfather who helps' }, { name: 'Mango', role: 'her playful cat' }],
    setting: 'A rainy harbour town', central_conflict: 'kite lost', goal: 'find it', emotional_arc: 'worried → brave → glad',
    beginning_state: 'rain', escalation: 'wind', climax: 'steps', resolution: 'found', ending_state: 'home', lesson: '', pages,
  }, 8)
  if (!v.ok) throw new Error(v.errors.join('; '))
  return v.plan
}

const IMANI = {
  requestId: '5c93e865-d6ca-47a9-b7e1-a18f6a4a82e5', childName: 'Imani', childAge: 6,
  childDescription: 'dark brown skin, two thick black braids with yellow beads, big round purple glasses, a chipped front tooth, always wears a bright orange raincoat and green wellies',
  supportingCharactersText: 'Grandpa Ode (her grandfather, tall, white beard, blue knitted hat, walking stick); Mango (a small orange cat with white paws and a bent tail)',
  customNotes: "Imani's favourite thing is a red tin bucket named Rumble that she carries everywhere.",
  illustrationStyle: 'watercolor', styleHint: 'soft watercolor', plan: plan([3, 4, 8]),
}
const bible = (overrides: Partial<typeof IMANI> = {}) => buildVisualBible({ ...IMANI, ...overrides })
const ode = (b: VisualBible) => b.supporting_characters.find(s => s.name === 'Grandpa Ode')!
const mango = (b: VisualBible) => b.supporting_characters.find(s => s.name === 'Mango')!

test('1-2. hair beads and a chipped tooth are preserved as structured facts and reach the protagonist anchor', () => {
  const b = bible()
  assert.ok(b.protagonist.appearance?.hair_accessories.includes('yellow beads'))
  assert.ok(b.protagonist.appearance?.features.includes('chipped front tooth'))
  const a = protagonistAnchor(b)
  assert.match(a, /yellow beads/); assert.match(a, /chipped front tooth/)
  // equivalent constructions, not the test phrases
  const other = parseAppearance('red curls with blue hair clips, a missing front tooth and a wobbly tooth', { subject: 'protagonist' })
  assert.ok(other.hair_accessories.includes('blue hair clips')); assert.ok(other.features.includes('missing front tooth'))
})

test('3. height/build descriptors are preserved for humans and sized animals', () => {
  const b = bible()
  assert.equal(ode(b).appearance?.build, 'tall')
  assert.match(supportingAnchor(ode(b)), /^Grandpa Ode is a tall adult who is the grandfather/)
  assert.equal(mango(b).appearance?.build, 'small')
  assert.match(supportingAnchor(mango(b)), /^Mango is a small orange cat/)
  const e = parseSupportingEntries('Mr Pike (her teacher, stocky, glasses); Lulu (a lanky grey dog)')
  assert.equal(e[0].appearance.build, 'stocky'); assert.equal(e[1].appearance.build, 'lanky')
  // "tall ship" is not a build
  assert.equal(parseAppearance('loves the tall ship in the harbour', { subject: 'protagonist' }).build, null)
})

test('4. bent tail and other animal markings are preserved', () => {
  const b = bible()
  assert.ok(mango(b).identity?.markings.includes('bent tail'))
  assert.match(supportingAnchor(mango(b)), /with white paws and bent tail/)
  const e = parseSupportingEntries('Pip (a grey rabbit with a stubby tail and one torn ear)')
  assert.ok(e[0].appearance.markings.includes('stubby tail')); assert.ok(e[0].appearance.markings.includes('one torn ear'))
})

test('5-7. a walking stick is a character prop, never a global recurring object; the bucket stays global', () => {
  const b = bible()
  assert.deepEqual(ode(b).appearance?.props, ['walking stick'])
  assert.match(supportingAnchor(ode(b)), /carrying walking stick/)
  assert.deepEqual(b.protagonist.recurring_objects, ['red tin bucket named Rumble'])
  assert.ok(!b.protagonist.recurring_objects.some(o => /stick/.test(o)))
  assert.deepEqual(b.protagonist.appearance?.props, [])
  assert.match(protagonistAnchor(b), /always with: red tin bucket named Rumble/)
  // a hero prop that duplicates the global object is not listed twice
  const b2 = bible({ childDescription: 'curly hair, always carries her red tin bucket', customNotes: "Imani's favourite thing is a red tin bucket named Rumble." })
  assert.deepEqual(b2.protagonist.appearance?.props, [])
  assert.equal(b2.protagonist.recurring_objects.length, 1)
})

test('8-10. the new facts appear in page and cover prompts through the same anchors', () => {
  const b = bible()
  const page = buildImagePrompt({ bible: b, pageNumber: 3, imageDescription: 'Grandpa Ode points while Imani and Mango look up.', planPage: findPlanPage(IMANI.plan, 3), safetySuffix: SAFETY }).prompt
  const cover = buildCoverPrompt({ bible: b, plan: IMANI.plan, tones: ['funny'], safetySuffix: SAFETY }).prompt
  for (const fact of ['yellow beads', 'chipped front tooth', 'tall adult', 'walking stick', 'bent tail']) {
    assert.ok(page.includes(fact), `page: ${fact}`); assert.ok(cover.includes(fact), `cover: ${fact}`)
  }
  assert.ok(cover.includes(supportingAnchor(ode(b))))
})

test('11. a supporting character named by the cover text is always anchored, even below the frequency threshold', () => {
  const b = bible()
  const p = plan([3], 'Imani and Mango hunt for a lost kite; Grandpa Ode waits at the harbour.')
  const cover = buildCoverPrompt({ bible: b, plan: p, tones: ['funny'], safetySuffix: SAFETY })
  assert.ok(cover.prompt.includes(supportingAnchor(ode(b))), 'named in premise → anchored')
  assert.equal(cover.meta.character_anchor_count, 3)
  assert.deepEqual(relevantSupportingForCover(b, p, p.premise).map(s => s.name).sort(), ['Grandpa Ode', 'Mango'])
})

test('12. an unselected supporting character is scrubbed from cover composition text', () => {
  const b = bible()
  const p = plan([3], "Imani and Mango hunt for a lost kite along Grandpa Ode's harbour wall.")
  // Ode: 1/8 beats, named in premise → anchored. Make him unselected by removing the mention and the beats:
  const p2 = plan([], 'Imani and Mango hunt for a lost kite along the harbour wall.')
  const cover2 = buildCoverPrompt({ bible: b, plan: p2, tones: ['funny'], safetySuffix: SAFETY })
  assert.ok(!/\bOde\b/.test(cover2.prompt)); assert.ok(!cover2.prompt.includes(supportingAnchor(ode(b))))
  // scrubbing replaces a name with a neutral role, possessives included
  assert.equal(scrubUnanchoredNames("Grandpa Ode's boat and Grandpa Ode", [ode(b)]), "her grandfather's boat and her grandfather")
  const p3 = { ...p, pages: p2.pages }
  const cover3 = buildCoverPrompt({ bible: b, plan: p3, tones: ['funny'], safetySuffix: SAFETY })
  // named in premise with zero beats: still anchored rather than scrubbed
  assert.ok(cover3.prompt.includes(supportingAnchor(ode(b))))
})

test('13. the cover companion limit still holds', () => {
  assert.equal(MAX_COVER_COMPANIONS, 2)
  const b = bible({ supportingCharactersText: 'Grandpa Ode (her grandfather); Mango (an orange cat); Nia (her best friend); Dr Lee (her doctor)' })
  const p = plan([1, 2, 3, 4, 5, 6, 7, 8], 'Imani, Mango, Grandpa Ode, Nia and Dr Lee all hunt for the kite.')
  const picked = relevantSupportingForCover(b, p, p.premise)
  assert.equal(picked.length, 2)
  const cover = buildCoverPrompt({ bible: b, plan: p, tones: ['funny'], safetySuffix: SAFETY })
  assert.equal(cover.meta.character_anchor_count, 3)
  for (const s of b.supporting_characters) if (!picked.includes(s)) assert.ok(!new RegExp(`\\b${s.name.split(' ')[0]}\\b`).test(cover.prompt), `${s.name} leaked`)
})

test('14-15. indefinite articles follow sound: an orange cat, a black cat, an 8-year-old, a unicorn, an hour', () => {
  assert.equal(withArticle('orange cat'), 'an orange cat'); assert.equal(withArticle('black cat'), 'a black cat')
  assert.equal(indefinite('8-year-old child'), 'an'); assert.equal(indefinite('6-year-old child'), 'a'); assert.equal(indefinite('11-year-old'), 'an')
  assert.equal(indefinite('unicorn'), 'a'); assert.equal(indefinite('hour'), 'an'); assert.equal(indefinite('elderly man'), 'an'); assert.equal(indefinite('CAT'), 'a'); assert.equal(indefinite('OWL'), 'an')
  const b = bible()
  assert.match(supportingAnchor(mango(b)), /is a small orange cat \(a CAT, never any other kind of animal\)/)
  const b2 = bible({ supportingCharactersText: 'Hoot (an owl)' })
  assert.match(supportingAnchor(b2.supporting_characters[0]), /is an owl \(an OWL, never any other kind of animal\)/)
  const b3 = bible({ childAge: 8 })
  assert.match(protagonistAnchor(b3), /^Imani is an 8-year-old child/)
  assert.ok(!/\ba (?:a|e|i|o|u)[a-z]+ (?:collar|cat|owl|t-shirt)/.test(supportingAnchor(mango(b))))
})

test('16-17. v1 and pre-1H.1 v2 bibles remain readable with the new optional fields absent', () => {
  assert.deepEqual(SUPPORTED_BIBLE_VERSIONS, [1, 2])
  const v1 = {
    version: 1, seed: 'abc',
    protagonist: { name: 'Sofia', approximate_age: 5, parent_visual_cues: ['curly brown hair'], canonical_outfit: 'a purple raincoat with blue boots', recurring_objects: [] },
    supporting_characters: [{ name: 'Mateo', role: 'little brother', visual_description: 'a smaller, younger child who is the little brother', canonical_outfit: 'a teal t-shirt with shorts' }],
    setting: { core_environment: 'beach', recurring_locations: [], important_objects: [] },
    art_direction: { illustration_style: 'watercolor', style_hint: 'soft watercolor', palette_guidance: 'sea blues', lighting_guidance: 'soft', medium: 'watercolor', consistency_rules: 'same book' },
  }
  const r1 = validateVisualBible(v1); assert.equal(r1.ok, true)
  if (r1.ok) { assert.match(protagonistAnchor(r1.bible), /^Sofia is a 5-year-old child with curly brown hair wearing a purple raincoat/); assert.match(supportingAnchor(r1.bible.supporting_characters[0]), /^Mateo is a smaller, younger child/) }
  // a v2 bible persisted by Phase 1H: no build / props keys, and strings written by the 1H code
  const v2 = JSON.parse(JSON.stringify(bible()))
  delete v2.protagonist.appearance.build; delete v2.protagonist.appearance.props
  for (const s of v2.supporting_characters) { delete s.appearance.build; delete s.appearance.props }
  v2.supporting_characters[0].visual_description = 'an adult who is the grandfather, white beard'
  const r2 = validateVisualBible(v2); assert.equal(r2.ok, true)
  if (r2.ok) {
    assert.match(protagonistAnchor(r2.bible), /^Imani is a 6-year-old child with dark brown skin/)
    assert.match(supportingAnchor(r2.bible.supporting_characters[0]), /^Grandpa Ode is an adult who is the grandfather, white beard, wearing blue knitted hat/)
    const page = buildImagePrompt({ bible: r2.bible, pageNumber: 1, imageDescription: 'Imani at the wall.', planPage: null, safetySuffix: SAFETY })
    assert.ok(page.prompt.endsWith(SAFETY))
  }
  // deterministic reconstruction is unchanged
  assert.deepEqual(buildVisualBible(IMANI), buildVisualBible(IMANI))
})
