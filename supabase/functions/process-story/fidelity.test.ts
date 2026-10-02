// Phase 1H visual fidelity — deterministic tests.
// Run: node --experimental-strip-types --test supabase/functions/process-story/fidelity.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  COVER_NO_TEXT_RULE,
  MAX_IMAGE_PROMPT_CHARS,
  NO_BRAND_RULE,
  NO_INVENTION_RULE,
  SUPPORTED_BIBLE_VERSIONS,
  VISUAL_BIBLE_VERSION,
  buildCoverPrompt,
  buildImagePrompt,
  buildOutfit,
  buildVisualBible,
  findPlanPage,
  protagonistAnchor,
  supportingAnchor,
  validateVisualBible,
  type VisualBible,
} from './visual.ts'
import { extractExplicitObjects, parseAppearance, parseSupportingEntries, splitSupportingEntries } from './appearance.ts'
import { validateStoryPlan, type StoryPlan } from './plan.ts'

const SAFETY = 'Child-safe, no text, no words in image.'
const ROOT = resolve(import.meta.dirname, '../../..')

function makePlan(pageCount = 8): StoryPlan {
  const pages = Array.from({ length: pageCount }, (_, i) => {
    const n = i + 1
    const phase = n === 1 ? 'setup' : n === 2 ? 'inciting' : n === pageCount - 1 ? 'climax' : n === pageCount ? 'resolution' : 'development'
    return {
      page: n, phase, purpose: 'Advance.', development: '',
      beat: n % 2 === 0 ? `Marisol and Pepper follow the hum of the compass to lantern ${n} while Tio Rafa watches.` : `Marisol checks lantern ${n}; Rafa calls from the stall.`,
      continuity: `Lantern ${n} is out; evening deepens.`,
    }
  })
  const v = validateStoryPlan({
    title: 'The Lantern\'s Last Light', premise: 'A night-market mystery when the harbour lanterns go out one by one.',
    protagonist: { name: 'Marisol', characterization: 'Determined and curious.', want: 'Relight the harbour.' },
    supporting_characters: [{ name: 'Tio Rafa', role: 'her uncle who runs a stall and offers advice' }, { name: 'Pepper', role: 'her trusty cat who sniffs out clues' }],
    setting: 'A seaside town night market at dusk', central_conflict: 'The lanterns keep going out.', goal: 'Find out why and fix it.',
    emotional_arc: 'curious → worried → brave → proud', beginning_state: 'Market bright.', escalation: 'More lanterns fail.', climax: 'The switchboard.', resolution: 'Lights return.', ending_state: 'Glowing.', lesson: '', pages,
  }, pageCount)
  if (!v.ok) throw new Error(v.errors.join('; '))
  return v.plan
}

const MARISOL = {
  requestId: 'req-fidelity-1',
  childName: 'Marisol',
  childAge: 8,
  childDescription: 'long black braid tied with a red ribbon, brown skin, a star-shaped freckle on her left cheek, always in a bright green raincoat',
  supportingCharactersText: "Tio Rafa (her uncle, tall, grey beard, blue fisherman's cap), Pepper (a small black cat with one white paw)",
  customNotes: 'Character traits: determined, curious\nStory conflict: solve a mystery\nMarisol never goes anywhere without her old brass compass, which hums softly when it points the right way.',
  illustrationStyle: 'storybook',
  styleHint: 'classic storybook illustration',
  plan: makePlan(8),
  consistencyRules: null,
}

const bible = () => buildVisualBible(MARISOL)
const pageOf = (b: VisualBible, n: number, desc: string) => buildImagePrompt({ bible: b, pageNumber: n, imageDescription: desc, planPage: findPlanPage(MARISOL.plan, n), safetySuffix: SAFETY })
const coverOf = (b: VisualBible) => buildCoverPrompt({ bible: b, plan: MARISOL.plan, tones: ['adventurous'], safetySuffix: SAFETY })

test('1-2. explicit braid and red ribbon survive bible creation and reach every anchor', () => {
  const b = bible()
  assert.ok(b.protagonist.parent_visual_cues.some(c => c.includes('long black braid')), JSON.stringify(b.protagonist.parent_visual_cues))
  assert.ok(b.protagonist.parent_visual_cues.includes('red ribbon'))
  const anchor = protagonistAnchor(b)
  assert.match(anchor, /long black braid/)
  assert.match(anchor, /red ribbon/)
  assert.match(anchor, /brown skin/)
  assert.match(anchor, /star-shaped freckle on her left cheek/)
  assert.ok(!/loose|curls/.test(anchor))
})

test('3-4. explicit green raincoat is kept and only missing slots are filled; nothing explicit is replaced', () => {
  const b = bible()
  assert.deepEqual(b.protagonist.outfit?.explicit, ['bright green raincoat'])
  assert.match(b.protagonist.canonical_outfit, /^bright green raincoat/)
  assert.ok(!/t-shirt|tee\b|overalls|dungarees/.test(b.protagonist.canonical_outfit), b.protagonist.canonical_outfit)
  // outerwear counts as the top: only bottoms and footwear are filled
  assert.equal(b.protagonist.outfit?.invented.length, 2)
  const full = buildOutfit(parseAppearance('a yellow dress and red wellies'), 'fallback', 'blue', 'seed', 'x')
  assert.deepEqual(full.explicit, ['yellow dress', 'red wellies'])
  assert.deepEqual(full.invented, [], 'dress fills top and bottom; wellies fill footwear')
  const none = buildOutfit(parseAppearance('loves trains'), 'a blue hoodie with blue trousers', 'blue', 'seed', 'x')
  assert.deepEqual(none.explicit, [])
  assert.equal(none.canonical, 'a blue hoodie with blue trousers')
})

test('5-6. "black cat with one white paw" stays species=cat, colour black, markings kept; the anchor forbids any other animal', () => {
  const b = bible()
  const pepper = b.supporting_characters.find(s => s.name === 'Pepper')!
  assert.equal(pepper.identity?.kind, 'animal')
  assert.equal(pepper.identity?.species, 'cat')
  assert.ok(pepper.identity?.markings.includes('black'))
  assert.ok(pepper.identity?.markings.includes('one white paw'))
  const anchor = supportingAnchor(pepper)
  assert.match(anchor, /Pepper is a (?:small )?black cat \(a CAT, never any other kind of animal\) with one white paw/)
  assert.ok(!/\bdog\b/.test(anchor))
})

test('7. several species keep their identity and colour', () => {
  const entries = parseSupportingEntries('Pico (a green parrot with a crooked beak); Biscuit (a sleepy old golden dog with floppy ears); Nibbles (a white rabbit with grey ears); Captain Fin (a goldfish); Sparks (a small red dragon)')
  const byName = Object.fromEntries(entries.map(e => [e.name, e]))
  assert.equal(byName.Pico.appearance.species, 'parrot'); assert.ok(byName.Pico.appearance.markings.includes('green')); assert.ok(byName.Pico.appearance.markings.includes('crooked beak'))
  assert.equal(byName.Biscuit.appearance.species, 'dog'); assert.ok(byName.Biscuit.appearance.markings.includes('floppy ears'))
  assert.equal(byName.Nibbles.appearance.species, 'rabbit'); assert.ok(byName.Nibbles.appearance.markings.includes('white'))
  assert.equal(byName['Captain Fin'].appearance.species, 'fish')
  assert.equal(byName.Sparks.appearance.species, 'dragon')
  const b = buildVisualBible({ ...MARISOL, supportingCharactersText: 'Pico (a green parrot with a crooked beak), Biscuit (a sleepy old golden dog)', plan: null })
  const pico = b.supporting_characters.find(s => s.name === 'Pico')!
  const biscuit = b.supporting_characters.find(s => s.name === 'Biscuit')!
  assert.match(supportingAnchor(pico), /a green parrot \(a PARROT, never any other kind of animal\) with crooked beak/)
  assert.match(supportingAnchor(biscuit), /golden dog \(a DOG, never any other kind of animal\)/)
})

test('8-9. commas inside one description do not create bogus characters; separate characters stay separate', () => {
  assert.deepEqual(splitSupportingEntries(MARISOL.supportingCharactersText), ["Tio Rafa (her uncle, tall, grey beard, blue fisherman's cap)", 'Pepper (a small black cat with one white paw)'])
  const b = bible()
  assert.deepEqual(b.supporting_characters.map(s => s.name), ['Tio Rafa', 'Pepper'])
  const rafa = b.supporting_characters[0]
  assert.equal(rafa.role, 'uncle')
  assert.ok(rafa.appearance?.features.includes('grey beard'))
  assert.deepEqual(rafa.outfit?.explicit, ["blue fisherman's cap"])
  assert.match(supportingAnchor(rafa), /grey beard/)
  assert.match(supportingAnchor(rafa), /blue fisherman's cap/)
  // dash and plain-comma formats
  assert.deepEqual(parseSupportingEntries('Grandpa Lou - bushy white moustache, red braces; Mila, her best friend, curly hair').map(e => e.name), ['Grandpa Lou', 'Mila'])
  assert.deepEqual(parseSupportingEntries('her little brother Mateo and Grandma Joyce').map(e => [e.name, e.role]), [['Mateo', 'little brother'], ['Grandma Joyce', 'grandma']])
})

test('10-11. character names never become recurring objects; the explicit brass compass does', () => {
  const b = bible()
  assert.deepEqual(b.protagonist.recurring_objects, ['old brass compass'])
  assert.ok(!b.protagonist.recurring_objects.some(o => /rafa|tio|pepper|marisol/i.test(o)))
  assert.deepEqual(extractExplicitObjects("Pip's favourite thing is a yellow bucket named Sunny that goes everywhere.", ['Pip']), ['yellow bucket named Sunny'])
  assert.deepEqual(extractExplicitObjects('Theo is kind and loves school.', ['Theo']), [])
  assert.match(protagonistAnchor(b), /always with: old brass compass/)
  assert.match(coverOf(b).prompt, /old brass compass/)
})

test('12. canonical full-length dungarees stay full-length in page and cover anchors', () => {
  const b = buildVisualBible({ ...MARISOL, requestId: 'req-overalls', childDescription: 'brown curls, always wears full-length denim dungarees over a red t-shirt' })
  assert.match(b.protagonist.canonical_outfit, /full-length denim dungarees/)
  const page = pageOf(b, 2, 'Marisol runs along the quay.').prompt
  const cover = coverOf(b).prompt
  assert.match(page, /full-length denim dungarees/)
  assert.match(cover, /full-length denim dungarees/)
  // invented dungarees are pinned too
  const inv = buildVisualBible({ ...MARISOL, requestId: 'req-overalls-2', childDescription: 'loves trains', plan: { ...MARISOL.plan, setting: 'a busy city street' } })
  if (/dungarees/.test(inv.protagonist.canonical_outfit)) assert.match(inv.protagonist.canonical_outfit, /full-length denim dungarees/)
})

test('13-14. page and cover consume identical protagonist and supporting identity facts', () => {
  const b = bible()
  const hero = protagonistAnchor(b)
  const pepper = supportingAnchor(b.supporting_characters.find(s => s.name === 'Pepper')!)
  const page = pageOf(b, 2, 'Marisol and Pepper follow the hum to the next lantern.').prompt
  const cover = coverOf(b).prompt
  assert.ok(page.includes(hero) && cover.includes(hero))
  assert.ok(page.includes(pepper) && cover.includes(pepper))
  assert.ok(page.indexOf('Characters in this scene') < page.indexOf('Scene:'), 'identity facts precede the scene')
})

test('15-16. no-logo / no-brand and anti-invention rules are in every page prompt and the cover', () => {
  const b = bible()
  for (const n of [1, 4, 8]) {
    const p = pageOf(b, n, `Marisol at lantern ${n}.`).prompt
    assert.ok(p.includes(NO_BRAND_RULE), `page ${n} brand rule`)
    assert.ok(p.includes(NO_INVENTION_RULE), `page ${n} invention rule`)
  }
  const c = coverOf(b).prompt
  assert.ok(c.includes(NO_BRAND_RULE) && c.includes(NO_INVENTION_RULE) && c.includes(COVER_NO_TEXT_RULE))
  assert.match(NO_BRAND_RULE, /logos/); assert.match(NO_BRAND_RULE, /trademarks/); assert.match(NO_BRAND_RULE, /brand names/)
})

test('17-19. brand rule, no-text rule and safety suffix survive hard truncation', () => {
  const b = bible()
  const huge = 'Marisol, Pepper and Tio Rafa examine every lantern on the quay. '.repeat(150)
  const page = buildImagePrompt({ bible: b, pageNumber: 3, imageDescription: huge, planPage: findPlanPage(MARISOL.plan, 3), safetySuffix: SAFETY })
  assert.ok(page.prompt.length <= MAX_IMAGE_PROMPT_CHARS)
  assert.equal(page.meta.truncated, true)
  assert.ok(page.prompt.endsWith(SAFETY))
  assert.ok(page.prompt.includes(NO_BRAND_RULE))
  const tiny = buildImagePrompt({ bible: b, pageNumber: 3, imageDescription: huge, planPage: null, safetySuffix: SAFETY, maxChars: 900 })
  assert.ok(tiny.prompt.length <= 900 && tiny.prompt.endsWith(SAFETY) && tiny.prompt.includes(NO_BRAND_RULE))
  const cover = buildCoverPrompt({ bible: b, plan: { ...MARISOL.plan, premise: 'x'.repeat(5000) }, safetySuffix: SAFETY, maxChars: 1200 })
  assert.ok(cover.prompt.length <= 1200 && cover.prompt.endsWith(SAFETY) && cover.prompt.includes(NO_BRAND_RULE) && cover.prompt.includes(COVER_NO_TEXT_RULE))
})

test('20. backfill reconstructs the same canonical anchors: a persisted bible round-trips byte-identically', () => {
  const b = bible()
  const persisted = JSON.parse(JSON.stringify(b))
  const v = validateVisualBible(persisted)
  assert.equal(v.ok, true)
  if (!v.ok) return
  assert.equal(protagonistAnchor(v.bible), protagonistAnchor(b))
  assert.deepEqual(v.bible.supporting_characters.map(supportingAnchor), b.supporting_characters.map(supportingAnchor))
  assert.equal(pageOf(v.bible, 2, 'Marisol and Pepper at the lantern.').prompt, pageOf(b, 2, 'Marisol and Pepper at the lantern.').prompt)
  assert.deepEqual(buildVisualBible(MARISOL), b, 'rebuilding from the same inputs is identical')
})

test('21. existing Phase 1E (v1) bibles remain readable and produce stable anchors without rewriting', () => {
  const v1 = {
    version: 1, seed: 'abc',
    protagonist: { name: 'Sofia', approximate_age: 5, parent_visual_cues: ['curly brown hair', 'glasses'], canonical_outfit: 'a purple raincoat with blue boots', recurring_objects: ['Tops'] },
    supporting_characters: [{ name: 'Mateo', role: 'little brother', visual_description: 'a smaller, younger child who is the little brother', canonical_outfit: 'a teal t-shirt with shorts' }],
    setting: { core_environment: 'A rocky beach', recurring_locations: [], important_objects: ['Tops'] },
    art_direction: { illustration_style: 'watercolor', style_hint: 'soft watercolor', palette_guidance: 'sea blues', lighting_guidance: 'soft', medium: 'watercolor', consistency_rules: 'same book' },
  }
  const v = validateVisualBible(v1)
  assert.equal(v.ok, true)
  assert.deepEqual(SUPPORTED_BIBLE_VERSIONS, [1, 2]); assert.equal(VISUAL_BIBLE_VERSION, 2)
  if (!v.ok) return
  assert.match(protagonistAnchor(v.bible), /^Sofia is a 5-year-old child with curly brown hair, glasses wearing a purple raincoat with blue boots \(always with: Tops\)/)
  assert.match(supportingAnchor(v.bible.supporting_characters[0]), /^Mateo is a smaller, younger child who is the little brother, wearing a teal t-shirt with shorts/)
  const p = buildImagePrompt({ bible: v.bible, pageNumber: 1, imageDescription: 'Sofia and Mateo at the pool.', planPage: null, safetySuffix: SAFETY })
  assert.ok(p.prompt.includes(NO_BRAND_RULE))
  assert.equal(validateVisualBible({ ...v1, version: 3 }).ok, false)
})

test('precedence: explicit parent facts outrank plan roles, inferred details and invented defaults', () => {
  // parent says cat; plan role calls Pepper a "trusty dog" → cat wins
  const b = buildVisualBible({ ...MARISOL, plan: { ...MARISOL.plan, supporting_characters: [{ name: 'Pepper', role: 'her trusty dog' }] } })
  const pepper = b.supporting_characters.find(s => s.name === 'Pepper')!
  assert.equal(pepper.identity?.species, 'cat')
  // parent gives no appearance for a plan-only character → plan role shapes it, nothing contradicted
  const b2 = buildVisualBible({ ...MARISOL, supportingCharactersText: null })
  assert.ok(b2.supporting_characters.some(s => s.name === 'Pepper' && s.identity?.species === 'cat'))
  // favourite colour is never inferred from a garment colour: red ribbon must not make the hero "love red"
  assert.equal(b.protagonist.appearance?.favourite_colour, null)
  // sensitive attributes are never invented: no skin/eyes unless supplied
  const b3 = buildVisualBible({ ...MARISOL, childDescription: 'loves football' })
  assert.ok(!/skin|eyes/.test(protagonistAnchor(b3)))
  // the index wires family notes into the builder so explicit objects can be read
  assert.match(readFileSync(resolve(ROOT, 'supabase/functions/process-story/index.ts'), 'utf8'), /customNotes: \(row\.custom_notes as string \| null\) \?\? null/)
})
