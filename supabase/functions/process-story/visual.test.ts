// Run: node --experimental-strip-types --test supabase/functions/process-story/visual.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_IMAGE_PROMPT_CHARS,
  buildImagePrompt,
  buildVisualBible,
  extractVisualCues,
  findPlanPage,
  parseSupportingText,
  protagonistAnchor,
  stableHash,
  validateVisualBible,
  type VisualBible,
} from './visual.ts'
import { validateStoryPlan, toSceneRows, validateBook, type StoryPlan } from './plan.ts'

// ── fixtures ────────────────────────────────────────────────────────────────

function makePlan(pageCount: number): StoryPlan {
  const pages = Array.from({ length: pageCount }, (_, i) => {
    const n = i + 1
    const phase = n === 1 ? 'setup' : n === 2 ? 'inciting' : n === pageCount - 1 ? 'climax' : n === pageCount ? 'resolution' : 'development'
    const withMateo = n % 3 === 0
    return {
      page: n,
      phase,
      beat: withMateo
        ? `Sofia and Mateo search pool number ${n} for Tops while the tide creeps in.`
        : `Sofia searches pool number ${n} for Tops on her own.`,
      purpose: 'Advance the search.',
      development: '',
      continuity: n === 4
        ? 'Sofia is now soaked to the knees; Tops still missing; dusk beginning.'
        : `Tops still missing after pool ${n}; late afternoon.`,
    }
  })
  const v = validateStoryPlan({
    title: 'The Triceratops Under the Tide',
    premise: 'Sofia loses Tops at the beach and must brave the rock pools before the tide comes in.',
    protagonist: { name: 'Sofia', characterization: 'Curious but shy; protective of Mateo.', want: 'Tops back before dark.' },
    supporting_characters: [{ name: 'Mateo', role: 'little brother who keeps wandering off' }, { name: 'Grandma', role: 'grandmother waiting at the beach house' }],
    setting: 'A rocky beach at low tide with glittering rock pools',
    central_conflict: 'The tide is rising and Tops is in the pools.',
    goal: 'Find Tops before the tide covers the pools.',
    emotional_arc: 'Worried → scared → brave → proud.',
    beginning_state: 'A happy beach day.',
    escalation: 'Each pool is deeper; the light fades.',
    climax: 'Sofia wades into the deepest pool herself.',
    resolution: 'Tops is wet but safe.',
    ending_state: 'Sofia trusts herself near the water.',
    lesson: '',
    pages,
  }, pageCount)
  assert.ok(v.ok)
  return (v as { ok: true; plan: StoryPlan }).plan
}

const bibleInput = (over: Partial<Parameters<typeof buildVisualBible>[0]> = {}) => ({
  requestId: '7d2c1e1a-0000-4000-8000-000000000001',
  childName: 'Sofia',
  childAge: 5,
  childDescription: 'Loves dinosaurs, obsessed with the colour purple, curly brown hair and glasses, very curious',
  supportingCharactersText: 'her little brother Mateo',
  illustrationStyle: 'watercolor',
  styleHint: "soft watercolor illustration, gentle washes of color, children's picture book style",
  plan: makePlan(8),
  ...over,
})

const SAFETY = 'Child-safe, no text, no words in image.'

function prompt(bible: VisualBible, plan: StoryPlan | null, page: number, desc: string, extra: Partial<Parameters<typeof buildImagePrompt>[0]> = {}) {
  return buildImagePrompt({ bible, pageNumber: page, imageDescription: desc, planPage: findPlanPage(plan, page), safetySuffix: SAFETY, bandImageHint: 'soft, rounded, friendly shapes', ...extra })
}

// ── 1. same protagonist anchor on every page ────────────────────────────────

test('1. the protagonist receives the identical canonical anchor on every page', () => {
  const bible = buildVisualBible(bibleInput())
  const plan = makePlan(8)
  const anchor = protagonistAnchor(bible)
  assert.match(anchor, /Sofia is a 5-year-old child with curly brown hair, glasses wearing a purple/)
  for (const n of [1, 2, 5, 8]) {
    const { prompt: p, meta } = prompt(bible, plan, n, `Sofia peers into rock pool ${n}.`)
    assert.ok(p.includes(anchor), `page ${n} missing anchor`)
    assert.equal(meta.protagonist_anchor, true)
  }
})

// ── 2/3. supporting characters only when present ────────────────────────────

test('2. a supporting character anchor appears when that character is in the scene', () => {
  const bible = buildVisualBible(bibleInput())
  const plan = makePlan(8)
  const { prompt: p, meta } = prompt(bible, plan, 3, 'Sofia and Mateo crouch at the edge of a rock pool.')
  assert.match(p, /Mateo is a smaller, younger child/)
  assert.equal(meta.supporting_present_count, 1)
  assert.equal(meta.character_anchor_count, 2)
})

test('3. supporting anchors are not forced into scenes that do not include them', () => {
  const bible = buildVisualBible(bibleInput())
  const plan = makePlan(8)
  const { prompt: p, meta } = prompt(bible, plan, 2, 'Sofia alone at the first shallow pool, a tiny crab under a ledge.')
  assert.doesNotMatch(p, /Mateo is/)
  assert.doesNotMatch(p, /Grandma is/)
  assert.equal(meta.supporting_present_count, 0)
  assert.equal(meta.character_anchor_count, 1)
  // a scene naming only Grandma gets Grandma, and the hero too because she is named in the beat for that page
  const { meta: m2 } = prompt(bible, plan, 5, 'Grandma waves from the beach-house porch.')
  assert.equal(m2.supporting_present_count, 1)
  assert.equal(m2.protagonist_anchor, true)
  // a scene naming only Grandma with no plan page: hero omitted
  const { meta: m3 } = buildImagePrompt({ bible, pageNumber: 5, imageDescription: 'Grandma waves from the beach-house porch.', planPage: null, safetySuffix: SAFETY })
  assert.equal(m3.protagonist_anchor, false)
  assert.equal(m3.supporting_present_count, 1)
})

// ── 4 / 14. continuity maps to the right page for every length ──────────────

test('4 & 14. page continuity maps to the correct plan page for 8-, 24- and 32-page plans', () => {
  for (const n of [8, 24, 32]) {
    const plan = makePlan(n)
    const bible = buildVisualBible(bibleInput({ plan }))
    for (const pageNumber of [1, 4, Math.floor(n / 2), n]) {
      const planPage = findPlanPage(plan, pageNumber)
      assert.ok(planPage && planPage.page === pageNumber)
      const { prompt: p, meta } = prompt(bible, plan, pageNumber, `Sofia at pool ${pageNumber}.`)
      assert.equal(meta.continuity_used, true)
      assert.ok(p.includes(planPage!.continuity), `page ${pageNumber}/${n} continuity missing`)
      if (pageNumber !== 4) assert.ok(!p.includes('soaked to the knees'))
    }
    assert.equal(findPlanPage(plan, n + 1), null)
  }
})

// ── 5. intentional state change augments, never replaces, the anchor ────────

test('5. a plan continuity state change is added for that page while the canonical anchor stays intact', () => {
  const bible = buildVisualBible(bibleInput())
  const plan = makePlan(8)
  const anchor = protagonistAnchor(bible)
  const { prompt: p } = prompt(bible, plan, 4, 'Sofia wades deeper, water at her knees.')
  assert.ok(p.includes(anchor))
  assert.match(p, /Page continuity \(temporary state for this page only[^)]*\): Sofia is now soaked to the knees/)
})

// ── 6. art direction consistent on every page ───────────────────────────────

test('6. illustration style, medium, palette and consistency rule appear on every page', () => {
  const bible = buildVisualBible(bibleInput())
  const plan = makePlan(8)
  for (const n of [1, 5, 8]) {
    const { prompt: p } = prompt(bible, plan, n, `Scene ${n}.`)
    assert.match(p, /^soft watercolor illustration, gentle washes of color, children's picture book style; soft watercolor on textured paper/)
    assert.match(p, /Palette: sea blues and greens/)
    assert.match(p, /Same illustrated book on every page/)
    assert.ok(p.endsWith(SAFETY))
  }
})

// ── 7. compositions stay free ───────────────────────────────────────────────

test('7. the page image description drives composition; no camera terms are injected', () => {
  const bible = buildVisualBible(bibleInput())
  const plan = makePlan(8)
  const wide = prompt(bible, plan, 1, 'A wide view of the whole beach, Sofia a small figure at the water line.').prompt
  const close = prompt(bible, plan, 7, 'Close on Sofia\'s hands closing around the wet triceratops.').prompt
  assert.match(wide, /Scene: A wide view of the whole beach/)
  assert.match(close, /Scene: Close on Sofia's hands/)
  assert.match(wide, /compositions may vary freely/)
  for (const p of [wide, close]) assert.doesNotMatch(p.replace(/compositions may vary freely \(wide, close, action, quiet\)/, ''), /\b(camera angle|shot type)\b/i)
})

// ── 8/9. determinism and persistence ────────────────────────────────────────

test('8. rebuilding the bible from the same inputs is byte-identical; a different request differs', () => {
  const a = buildVisualBible(bibleInput())
  const b = buildVisualBible(bibleInput())
  assert.deepEqual(a, b)
  assert.equal(JSON.stringify(a), JSON.stringify(b))
  const other = buildVisualBible(bibleInput({ requestId: '00000000-0000-4000-8000-00000000beef' }))
  assert.notEqual(other.protagonist.canonical_outfit, a.protagonist.canonical_outfit)
  assert.equal(stableHash('x'), stableHash('x'))
})

test('9. a persisted bible validates and is what a resumed worker reuses', () => {
  const built = buildVisualBible(bibleInput())
  const roundTrip = JSON.parse(JSON.stringify(built))
  const v = validateVisualBible(roundTrip)
  assert.ok(v.ok)
  assert.deepEqual((v as { ok: true; bible: VisualBible }).bible, built)
  assert.equal(validateVisualBible(null).ok, false)
  assert.equal(validateVisualBible({ version: 1 }).ok, false)
  assert.equal(validateVisualBible({ ...roundTrip, version: 99 }).ok, false)
})

// ── 10. privacy ─────────────────────────────────────────────────────────────

test('10. private, account, payment and worker fields never enter the bible or the prompt', () => {
  const bible = buildVisualBible(bibleInput({ childDescription: 'Loves dinosaurs, lives at 12 Harbour Road, email parent@example.com, curly brown hair' }))
  const plan = makePlan(8)
  const all = JSON.stringify(bible) + prompt(bible, plan, 1, 'Sofia at the pools.').prompt
  for (const leak of ['parent@example.com', 'Harbour Road', '7d2c1e1a', 'story_pro', '203.0.113.9', 'w-123', 'worker', 'lease', 'stripe']) {
    assert.ok(!all.toLowerCase().includes(leak.toLowerCase()), `leaked ${leak}`)
  }
  // only visual cues from the description survive
  assert.deepEqual(extractVisualCues('Loves dinosaurs, lives at 12 Harbour Road, email parent@example.com, curly brown hair'), ['curly brown hair'])
  assert.ok(!JSON.stringify(bible).includes('dinosaurs'))
})

test('10b. no sensitive physical attributes are invented; invented details are outfit colours and garments only', () => {
  const bible = buildVisualBible(bibleInput({ childDescription: 'Loves trains and the sea' }))
  assert.deepEqual(bible.protagonist.parent_visual_cues, [])
  assert.match(bible.protagonist.canonical_outfit, /^a (red|yellow|green|blue|orange|purple|teal|pink)/)
  const anchor = protagonistAnchor(bible)
  assert.doesNotMatch(anchor, /\b(skin|eyes?|ethnic|race|disab)/i)
})

// ── 11. bounded prompt length ───────────────────────────────────────────────

test('11. the final prompt is bounded and always ends with the safety suffix', () => {
  const bible = buildVisualBible(bibleInput())
  const plan = makePlan(8)
  const huge = 'Sofia, Mateo and Grandma examine every shell on the beach. '.repeat(120)
  const { prompt: p, meta } = prompt(bible, plan, 3, huge)
  assert.ok(p.length <= MAX_IMAGE_PROMPT_CHARS, `length ${p.length}`)
  assert.ok(p.endsWith(SAFETY))
  assert.equal(meta.truncated, true)
  assert.match(p, /Sofia is a 5-year-old child/)
  const normal = prompt(bible, plan, 3, 'Sofia and Mateo at the pool.')
  assert.equal(normal.meta.truncated, false)
  assert.ok(normal.meta.prompt_length < 2100)
})

// ── 12/13. downstream contracts and resume behaviour ────────────────────────

test('12. the scene contract is unchanged: image_prompt still holds the raw page image description', () => {
  const b = validateBook({ title: 'The Triceratops Under the Tide', pages: Array.from({ length: 8 }, (_, i) => ({ page: i + 1, text: `Page ${i + 1} prose.`, image_description: `Sofia at pool ${i + 1}.` })) }, 8)
  assert.ok(b.ok)
  const rows = toSceneRows((b as { ok: true; book: never }).book, { storyId: 's', requestId: 'r' })
  assert.equal(rows[2].image_prompt, 'Sofia at pool 3.')
  assert.deepEqual(Object.keys(rows[0]).sort(), ['image_prompt', 'image_status', 'page_number', 'page_text', 'request_id', 'story_id'])
})

test('13. a resumed worker without the plan still gets a usable, deterministic bible', () => {
  const noPlan = buildVisualBible(bibleInput({ plan: null }))
  assert.equal(noPlan.setting.core_environment, '')
  assert.deepEqual(noPlan.supporting_characters.map(s => s.name), ['Mateo'])
  assert.deepEqual(noPlan, buildVisualBible(bibleInput({ plan: null })))
  const { prompt: p, meta } = buildImagePrompt({ bible: noPlan, pageNumber: 2, imageDescription: 'Sofia at the pool.', planPage: null, safetySuffix: SAFETY })
  assert.equal(meta.continuity_used, false)
  assert.match(p, /Sofia is a 5-year-old child/)
})

// ── helpers ─────────────────────────────────────────────────────────────────

test('supporting characters from the plan and the parent text are merged without duplicates; recurring objects come from the plan', () => {
  const bible = buildVisualBible(bibleInput({ supportingCharactersText: 'her little brother Mateo and Grandma Joyce' }))
  assert.deepEqual(bible.supporting_characters.map(s => s.name), ['Mateo', 'Grandma Joyce'])
  assert.deepEqual(bible.protagonist.recurring_objects, ['Tops'])
  assert.deepEqual(parseSupportingText('her little brother Mateo, Grandma Joyce'), [{ name: 'Mateo', role: 'little brother' }, { name: 'Grandma Joyce', role: 'grandma' }])
  assert.deepEqual(parseSupportingText(null), [])
})
