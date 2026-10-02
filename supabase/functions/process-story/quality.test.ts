// Run: node --experimental-strip-types --test supabase/functions/process-story/quality.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessBookQuality, splitSentences, wordCount, type QualityPage } from './quality.ts'
import { buildBookPrompt, buildStoryPrompt } from './prompt.ts'
import { buildRepairMessages, toSceneRows, validateBook, validateStoryPlan, type StoryPlan } from './plan.ts'

// ── fixtures ────────────────────────────────────────────────────────────────

// Eight middle-band pages (about 60-68 words each) with varied openings,
// varied endings, some dialogue, no stock phrases.
const VARIED = [
  'Sofia pressed her nose to the cold glass of the beach-house window. Outside, the tide pools glittered like spilled coins, and somewhere out there Tops was waiting. She had set him on a rock to dry, just for a minute, while Mateo chased a gull. Now the rock was empty and the water was creeping back in.',
  'Mateo tugged at her sleeve until the wool stretched. "Can we go now?" he asked, already halfway out the door with one shoe on. Sofia wanted to say no. The pools looked bigger than they had at lunch, and darker. But Tops was out there, and nobody else was going to fetch him, so she took his hand and went.',
  'The first pool was shallow and warm, no deeper than a bath. A crab the size of a thumbnail scuttled under a ledge when her shadow fell across it. Sofia crouched and looked anyway, under every weedy edge, because Tops was small and orange and could have slipped anywhere. He had not. Mateo was already splashing ahead.',
  'By the third pool the water reached her knees and had gone the colour of tea. Tops was nowhere, and the sun had dropped behind the headland, flattening everything to grey. Mateo stopped singing. "Is he gone?" he said. Sofia did not answer, because the honest answer was one she did not want him to hear.',
  'Something orange bobbed between two boulders at the far edge, where the big waves came in. Sofia counted the gap between them the way Dad had taught her: one, two, three, then a crash. Three counts. Long enough to wade out, not long enough to wade back. She looked at Mateo, then at the orange shape, and made her choice.',
  'Her feet knew the way before she did. Cold water, slick weed, a stone that wobbled and then held. Mateo stayed on the dry rock because she had told him to, and for once he did as he was told. Two counts in, her fingers closed on wet fur and a hard plastic frill. Tops. She did not stop to feel glad.',
  'The wave came late, which was the only luck she had that day. By the time it broke she was already climbing back, Tops dripping under one arm, her other hand reaching for her brother. Mateo grabbed it and pulled as if she weighed nothing. They sat on the dry rock together and watched the pool fill up behind them.',
  'That night Tops slept on the windowsill, where the sea could see him too. Mateo fell asleep mid-sentence. Sofia lay awake a while longer, listening to the waves she had counted, and found that the sound did not frighten her the way it had that morning. Tomorrow she might wade in again, she thought. Just to look.',
]

function pages(texts: string[], descFn: (i: number) => string = i => `Sofia at the rock pools, moment ${i + 1}, late afternoon light.`): QualityPage[] {
  return texts.map((text, i) => ({ page: i + 1, text, image_description: descFn(i) }))
}

const middleOpts = { ageBand: 'middle' as const, pageCount: 8 }
const youngOpts = { ageBand: 'young' as const, pageCount: 8 }

const codes = (r: { errors: { code: string }[]; warnings: { code: string }[] }) => ({
  errors: r.errors.map(e => e.code),
  warnings: r.warnings.map(w => w.code),
})

// ── 1. repeated sentence openings ───────────────────────────────────────────

test('1. excessive repeated sentence openings are detected as a repair-worthy error', () => {
  const texts = Array.from({ length: 8 }, (_, i) =>
    `Sofia looked at the pool number ${i + 1} very carefully before she moved. Sofia looked at the sky above it too, in case of rain. Sofia looked at Mateo and then the crab moved and water splashed over the stones.`)
  const r = codes(assessBookQuality({ pages: pages(texts) }, middleOpts))
  assert.ok(r.errors.includes('repeated_openings'), JSON.stringify(r))
})

test('1b. identical page openings on most pages are an error for middle, a warning for young', () => {
  const texts = Array.from({ length: 8 }, (_, i) => `One day Sofia found a shell number ${i + 1} on the sand and carried it home in her pocket.`)
  assert.ok(codes(assessBookQuality({ pages: pages(texts) }, middleOpts)).errors.includes('repeated_page_openings'))
  const y = codes(assessBookQuality({ pages: pages(texts) }, youngOpts))
  assert.ok(!y.errors.includes('repeated_page_openings'))
  assert.ok(y.warnings.includes('repeated_page_openings'))
})

// ── 2. legitimate repetition is not rejected ────────────────────────────────

test('2. a single legitimate repeated phrase or refrain is not an error', () => {
  const texts = [...VARIED]
  texts[2] = 'Tops was still missing. The first pool was shallow and warm. A crab scuttled under a rock.'
  texts[5] = 'Tops was still missing. Her feet knew the way before she did. Cold water, slick weed.'
  const r = codes(assessBookQuality({ pages: pages(texts) }, middleOpts))
  assert.deepEqual(r.errors, [])
  // the young band may keep a refrain on three pages and only gets a note
  const refrain = [...VARIED]
  refrain[1] = 'Where is Tops, where is Tops, where did Tops go now? ' + refrain[1]
  refrain[3] = 'Where is Tops, where is Tops, where did Tops go now? ' + refrain[3]
  refrain[5] = 'Where is Tops, where is Tops, where did Tops go now? ' + refrain[5]
  const y = codes(assessBookQuality({ pages: pages(refrain) }, youngOpts))
  assert.deepEqual(y.errors, [])
  assert.ok(y.warnings.includes('refrain_detected'))
})

// ── 3. announced moral endings ──────────────────────────────────────────────

test('3. a stock explicit moral ending triggers the announced_moral signal (error for middle, warning for young)', () => {
  const texts = [...VARIED]
  texts[7] = 'That night Tops slept on the windowsill. And Sofia learned that courage means doing the scary thing for someone you love.'
  const m = codes(assessBookQuality({ pages: pages(texts) }, middleOpts))
  assert.ok(m.errors.includes('announced_moral'))
  const y = codes(assessBookQuality({ pages: pages(texts) }, youngOpts))
  assert.ok(!y.errors.includes('announced_moral'))
  assert.ok(y.warnings.includes('announced_moral'))
  // the same phrase in the middle of the book is not an ending signal
  const mid = [...VARIED]
  mid[3] = 'She learned that the third pool was deeper than it looked, and Tops was nowhere.'
  assert.ok(!codes(assessBookQuality({ pages: pages(mid) }, middleOpts)).errors.includes('announced_moral'))
})

test('3b. two or more stock phrases are an error; a single one is a warning', () => {
  const two = [...VARIED]
  two[0] = 'Once upon a time, Sofia pressed her nose to the cold glass.'
  two[6] = 'Little did Sofia know, the wave was late. She climbed back with Tops under one arm.'
  const r = codes(assessBookQuality({ pages: pages(two) }, middleOpts))
  assert.ok(r.errors.includes('stock_phrases'))
  const one = [...VARIED]
  one[0] = 'Once upon a time, Sofia pressed her nose to the cold glass.'
  const r1 = codes(assessBookQuality({ pages: pages(one) }, middleOpts))
  assert.ok(!r1.errors.includes('stock_phrases'))
  assert.ok(r1.warnings.includes('stock_phrase_once'))
})

// ── 4. exclamation marks ────────────────────────────────────────────────────

test('4. excessive exclamation use is detected conservatively', () => {
  const shouty = VARIED.map(t => t.replace(/\./g, '!'))
  assert.ok(codes(assessBookQuality({ pages: pages(shouty) }, middleOpts)).errors.includes('exclamation_excess'))
  const fewBangs = [...VARIED]
  fewBangs[1] = 'Mateo tugged her sleeve. "Can we go now!" he asked, already halfway out the door.'
  fewBangs[6] = 'The wave came late! She was already climbing back with Tops dripping under one arm.'
  const r = codes(assessBookQuality({ pages: pages(fewBangs) }, middleOpts))
  assert.ok(!r.errors.includes('exclamation_excess'))
  assert.ok(!r.warnings.includes('exclamation_heavy'))
})

// ── 5. page-count validation still works ────────────────────────────────────

test('5. structural page-count validation is unchanged and runs before quality', () => {
  const book = { title: 'The Triceratops Under the Tide', pages: pages(VARIED.slice(0, 7)) }
  const v = validateBook(book, 8)
  assert.ok(!v.ok && v.errors.some(e => /exactly 8 are required/.test(e)))
  assert.ok(validateBook({ title: 'The Triceratops Under the Tide', pages: pages(VARIED) }, 8).ok)
})

// ── 6. age-band word-count extremes ─────────────────────────────────────────

test('6. gross word-count violations: many extreme pages → error, one → warning, near-empty → error', () => {
  const longText = Array.from({ length: 50 }, (_, i) => `Sentence number ${i + 1} of a very long page keeps going on and on.`).join(' ')
  const manyLong = VARIED.map(() => longText)
  assert.ok(codes(assessBookQuality({ pages: pages(manyLong) }, youngOpts)).errors.includes('page_length_extreme'))
  const oneLong = [...VARIED]
  oneLong[3] = longText
  const r = codes(assessBookQuality({ pages: pages(oneLong) }, youngOpts))
  assert.ok(!r.errors.includes('page_length_extreme'))
  assert.ok(r.warnings.includes('page_length_outlier'))
  const nearEmpty = [...VARIED]
  nearEmpty[4] = 'Then.'
  assert.ok(codes(assessBookQuality({ pages: pages(nearEmpty) }, middleOpts)).errors.includes('near_empty_page'))
  // the varied fixture is comfortably within middle range → no length signals at all
  const clean = codes(assessBookQuality({ pages: pages(VARIED) }, middleOpts))
  assert.ok(!clean.errors.some(c => c.startsWith('page_length')))
})

test('6b. a well-formed varied book produces no errors', () => {
  const r = codes(assessBookQuality({ pages: pages(VARIED) }, middleOpts))
  assert.deepEqual(r.errors, [])
})

// ── 7-9. prompt policy presence ─────────────────────────────────────────────

function samplePlan(): StoryPlan {
  const raw = {
    title: 'The Triceratops Under the Tide',
    premise: 'Sofia must brave the rock pools to find Tops before the tide comes in.',
    protagonist: { name: 'Sofia', characterization: 'Curious but shy; protective of Mateo.', want: 'Tops back before dark.' },
    supporting_characters: [{ name: 'Mateo', role: 'little brother' }],
    setting: 'A rocky beach at low tide',
    central_conflict: 'The tide is rising and Tops is in the pools.',
    goal: 'Find Tops before the tide covers the pools.',
    emotional_arc: 'Worried → scared → brave → proud.',
    beginning_state: 'A happy beach day.',
    escalation: 'Each pool is deeper; the light fades.',
    climax: 'Sofia wades into the deepest pool herself.',
    resolution: 'Tops is wet but safe.',
    ending_state: 'Sofia trusts herself near the water.',
    lesson: 'Courage is doing the scary thing for someone you love.',
    pages: Array.from({ length: 8 }, (_, i) => ({
      page: i + 1,
      phase: i === 0 ? 'setup' : i === 1 ? 'inciting' : i === 6 ? 'climax' : i === 7 ? 'resolution' : 'development',
      beat: `Beat ${i + 1}: Sofia moves one pool closer to Tops.`,
      purpose: 'Advance the search.',
      development: '',
      continuity: 'Tops still missing.',
    })),
  }
  const v = validateStoryPlan(raw, 8)
  assert.ok(v.ok)
  return (v as { ok: true; plan: StoryPlan }).plan
}

const request = () => ({
  child_name: 'Sofia', child_age: 5, child_description: 'Loves dinosaurs', story_theme: 'An underwater adventure',
  story_tone: ['magical', 'brave'], story_length: 8, illustration_style: 'watercolor',
  custom_notes: 'Character traits: curious, shy\nShe sleeps with a stuffed triceratops called Tops.',
  user_email: 'parent@example.com', id: '7d2c1e1a-0000-4000-8000-000000000001', plan_tier: 'story_pro', ip_address: '203.0.113.9',
})

test('7. personalization instructions remain present in the book prompt', () => {
  const [system, user] = buildBookPrompt(request(), samplePlan(), {}, 'en')
  assert.match(user.content, /Family notes: She sleeps with a stuffed triceratops called Tops\./)
  assert.match(user.content, /Personality: curious, shy/)
  assert.match(system.content, /Treat "Family notes" as creative direction/)
  assert.match(system.content, /\(1\) safety and the output format, \(2\) the age-band rules/)
})

test('8. story-plan fidelity instructions remain present and the craft policy sits after the band rules', () => {
  const [system, user] = buildBookPrompt(request(), samplePlan(), {}, 'en')
  assert.match(system.content, /Page N of your prose must realise page beat N/)
  assert.match(user.content, /STORY PLAN \(follow exactly/)
  const idxLength = system.content.indexOf('Age-band length rule:')
  const idxCraft = system.content.indexOf('Prose craft:')
  const idxReadAloud = system.content.indexOf('Read-aloud and voice for this age:')
  assert.ok(idxLength > 0 && idxReadAloud > idxLength && idxCraft > idxReadAloud)
  assert.match(system.content, /This rule overrides any earlier instruction to state the moral directly/)
  assert.match(system.content, /DIALOGUE — use it when it reveals character/)
  assert.match(system.content, /"Little did X know"/)
})

test('8b. read-aloud guidance follows the age band', () => {
  const [young] = buildBookPrompt(request(), samplePlan(), {}, 'en')
  assert.match(young.content, /breath-sized phrases/)
  assert.match(young.content, /never force rhyme/)
  const [teen] = buildBookPrompt({ ...request(), child_age: 15 }, samplePlan(), {}, 'en')
  assert.match(teen.content, /never sound childish/)
  assert.doesNotMatch(teen.content, /breath-sized phrases/)
})

test('9. prose and image_description responsibilities are explicitly separated in the prompt and checked after', () => {
  const [system] = buildBookPrompt(request(), samplePlan(), {}, 'en')
  assert.match(system.content, /"text" is the reader-facing prose and must never contain illustration or camera language/)
  assert.match(system.content, /"image_description" is a production instruction for the illustrator/)
  const leaky = [...VARIED]
  leaky[1] = 'Close-up of Mateo tugging her sleeve, in the foreground, watercolor style.'
  leaky[4] = 'The illustration shows something orange bobbing between two boulders.'
  const r = codes(assessBookQuality({ pages: pages(leaky) }, middleOpts))
  assert.ok(r.errors.includes('prose_contains_image_directions'))
  const repeatDesc = pages(VARIED, i => VARIED[i])
  const r2 = codes(assessBookQuality({ pages: repeatDesc }, middleOpts))
  assert.ok(r2.warnings.includes('image_description_repeats_text'))
  assert.ok(!r2.errors.includes('image_description_repeats_text'))
})

test('9b. legacy single-pass builder also carries the craft layer', () => {
  const [system] = buildStoryPrompt(request(), {}, 'en')
  assert.match(system.content, /Prose craft:/)
  assert.match(system.content, /- Write exactly 8 story pages/)
})

// ── 10. privacy ─────────────────────────────────────────────────────────────

test('10. private and account data stays out of the book prompt', () => {
  const all = buildBookPrompt(request(), samplePlan(), {}, 'en').map(m => m.content).join('\n')
  for (const leak of ['parent@example.com', '7d2c1e1a', 'story_pro', '203.0.113.9']) assert.ok(!all.includes(leak), leak)
})

test('10b. quality signal codes contain no story text', () => {
  const texts = [...VARIED]
  texts[7] = 'And Sofia learned that courage is doing the scary thing.'
  const r = assessBookQuality({ pages: pages(texts) }, middleOpts)
  for (const issue of [...r.errors, ...r.warnings]) {
    assert.match(issue.code, /^[a-z_]+$/)
    assert.ok(!issue.code.includes('Sofia'))
  }
})

// ── 11. repair remains bounded ──────────────────────────────────────────────

test('11. book repair messages name the quality problems and keep the plan authoritative', () => {
  const original = [{ role: 'system', content: 'S' }, { role: 'user', content: 'U with STORY PLAN' }]
  const msgs = buildRepairMessages(original, '{"title":"x"}', ['repeated_openings: 9 of 24 sentences begin with "sofia looked" — vary how sentences start'], 'book')
  assert.equal(msgs.length, 4)
  assert.match(msgs[3].content, /repeated_openings/)
  assert.match(msgs[3].content, /STORY PLAN stays authoritative/)
  assert.match(msgs[3].content, /revise only the prose and image descriptions/)
})

// ── 12. downstream scene shape ──────────────────────────────────────────────

test('12. scene rows are unchanged by the quality layer', () => {
  const v = validateBook({ title: 'The Triceratops Under the Tide', pages: pages(VARIED) }, 8)
  assert.ok(v.ok)
  const rows = toSceneRows((v as { ok: true; book: never }).book, { storyId: 's', requestId: 'r' })
  assert.equal(rows.length, 8)
  assert.deepEqual(Object.keys(rows[0]).sort(), ['image_prompt', 'image_status', 'page_number', 'page_text', 'request_id', 'story_id'])
})

// ── helpers ─────────────────────────────────────────────────────────────────

test('sentence splitting and word counting behave on quotes, ellipses and names', () => {
  assert.equal(splitSentences('"Can we go now?" he asked. She nodded… Then they ran!').length, 3)
  assert.equal(wordCount("Sofia's crab didn't move."), 4)
})
