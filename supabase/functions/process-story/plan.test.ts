// Run: node --experimental-strip-types --test supabase/functions/process-story/plan.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GENERIC_TITLE_RE,
  MAX_STAGE_ATTEMPTS,
  buildRepairMessages,
  isGenericTitle,
  renderPlanForPrompt,
  safeParseJson,
  sumUsage,
  toSceneRows,
  validateBook,
  validateStoryPlan,
  type StoryPlan,
} from './plan.ts'
import { buildBookPrompt, buildPlanPrompt, pacingGuidance } from './prompt.ts'

// ── fixtures ────────────────────────────────────────────────────────────────

function makePlan(pageCount: number, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  const pages = Array.from({ length: pageCount }, (_, i) => {
    const n = i + 1
    const phase =
      n === 1 ? 'setup'
      : n === 2 ? 'inciting'
      : n === pageCount - 1 ? 'climax'
      : n === pageCount ? 'resolution'
      : n % 4 === 0 ? 'complication' : 'development'
    return {
      page: n,
      phase,
      beat: `On page ${n} Sofia does something that follows from page ${n - 1}.`,
      purpose: `Advance the search for Tops (page ${n}).`,
      development: n % 2 === 0 ? 'Sofia grows a little braver.' : '',
      continuity: 'Tops is still missing; Mateo is with her.',
    }
  })
  return {
    title: 'The Triceratops Under the Tide',
    premise: 'Sofia loses her stuffed triceratops at the beach and must brave the rock pools to find it before the tide comes in.',
    protagonist: { name: 'Sofia', characterization: 'Curious but shy; fiercely protective of her little brother Mateo.', want: 'To get Tops back before dark.' },
    supporting_characters: [{ name: 'Mateo', role: 'little brother who keeps wandering off' }],
    setting: 'A rocky beach at low tide',
    central_conflict: 'The tide is rising and Tops is somewhere in the rock pools.',
    goal: 'Find Tops before the tide covers the pools.',
    emotional_arc: 'Worried → scared of the dark water → brave → relieved and proud.',
    beginning_state: 'A happy beach day; Sofia never lets Tops out of her sight.',
    escalation: 'Each pool is deeper; Mateo wanders toward the water; the light fades.',
    climax: 'Sofia chooses to wade into the deepest pool herself to grab Tops before a wave takes it.',
    resolution: 'Tops is wet but safe; Sofia carries Mateo back up the beach.',
    ending_state: 'Sofia trusts herself near the water now.',
    lesson: 'Courage is doing the scary thing for someone you love.',
    pages,
    ...overrides,
  }
}

function makeBook(pageCount: number, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    title: 'The Triceratops Under the Tide',
    subtitle: '',
    author_line: 'A Nest & Quill Original',
    dedication: '',
    synopsis: 'Sofia braves the rock pools.',
    pages: Array.from({ length: pageCount }, (_, i) => ({
      page: i + 1,
      text: `Page ${i + 1} prose about Sofia.`,
      image_description: `Sofia on the beach, page ${i + 1}.`,
    })),
    ...overrides,
  }
}

const request = () => ({
  child_name: 'Sofia',
  child_age: 5,
  child_description: 'Loves dinosaurs, very curious',
  story_theme: 'An underwater adventure beneath the waves',
  story_tone: ['magical', 'brave'],
  story_length: 8,
  illustration_style: 'watercolor',
  supporting_characters: 'her little brother Mateo',
  custom_notes: 'Character traits: curious, shy, protective\nShe sleeps with a stuffed triceratops called Tops.',
  // internal fields that must never reach the model
  id: '7d2c1e1a-0000-4000-8000-000000000001',
  user_email: 'parent@example.com',
  plan_tier: 'story_pro',
  ip_address: '203.0.113.9',
  worker_id: 'w-123',
})

// ── 1-3. page beat count must equal the requested page count ────────────────

for (const n of [8, 24, 32]) {
  test(`${n}-page request requires exactly ${n} outline beats`, () => {
    assert.equal(validateStoryPlan(makePlan(n), n).ok, true)
    const short = validateStoryPlan(makePlan(n - 1), n)
    assert.equal(short.ok, false)
    assert.ok(!short.ok && short.errors.some(e => e.includes(`exactly ${n} are required`)))
    const long = validateStoryPlan(makePlan(n + 1), n)
    assert.equal(long.ok, false)
  })
}

// ── 4. missing climax / resolution ──────────────────────────────────────────

test('missing climax or resolution fails outline validation', () => {
  const noClimax = makePlan(8)
  ;(noClimax.pages as { phase: string }[]).forEach(p => { if (p.phase === 'climax') p.phase = 'development' })
  const r1 = validateStoryPlan(noClimax, 8)
  assert.ok(!r1.ok && r1.errors.some(e => /climax/.test(e)))

  const noResolutionText = makePlan(8, { resolution: '' })
  const r2 = validateStoryPlan(noResolutionText, 8)
  assert.ok(!r2.ok && r2.errors.some(e => /resolution is missing/.test(e)))

  const noResolutionBeat = makePlan(8)
  ;(noResolutionBeat.pages as { phase: string }[]).forEach(p => { if (p.phase === 'resolution') p.phase = 'development' })
  const r3 = validateStoryPlan(noResolutionBeat, 8)
  assert.ok(!r3.ok && r3.errors.some(e => /marked as resolution/.test(e)))
})

// ── 5. empty beats ──────────────────────────────────────────────────────────

test('empty or too-thin beats fail validation', () => {
  const plan = makePlan(8)
  ;(plan.pages as { beat: string }[])[3].beat = '  '
  ;(plan.pages as { beat: string }[])[5].beat = 'Then.'
  const r = validateStoryPlan(plan, 8)
  assert.ok(!r.ok)
  assert.ok(r.errors.some(e => e.startsWith('page 4:')))
  assert.ok(r.errors.some(e => e.startsWith('page 6:')))
})

test('generic titles are rejected so the repair asks for a specific one', () => {
  for (const t of ['The Magical Adventure', 'A Journey of Friendship', 'The Brave Little Hero', 'The Great Adventure', '']) {
    assert.equal(isGenericTitle(t), true, t)
  }
  for (const t of ['The Triceratops Under the Tide', 'Mateo and the Missing Moon', "Sofia's Purple Umbrella"]) {
    assert.equal(isGenericTitle(t), false, t)
  }
  const r = validateStoryPlan(makePlan(8, { title: 'The Magical Adventure' }), 8)
  assert.ok(!r.ok && r.errors.some(e => /generic/.test(e)))
  assert.ok(GENERIC_TITLE_RE.test('The Great Adventure'))
})

// ── 6. malformed JSON → bounded repair ──────────────────────────────────────

test('malformed JSON is recovered when fenced or wrapped, otherwise reported for repair', () => {
  assert.equal(safeParseJson('```json\n{"a":1}\n```').ok, true)
  assert.equal(safeParseJson('Here you go: {"a":1} hope that helps').ok, true)
  const bad = safeParseJson('{"title": "x", "pages": [')
  assert.equal(bad.ok, false)
  assert.ok(!bad.ok && /not valid JSON/.test(bad.error))
})

test('repair conversation is bounded: one attempt plus one repair, with the errors listed', () => {
  assert.equal(MAX_STAGE_ATTEMPTS, 2)
  const original = [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }]
  const repaired = buildRepairMessages(original, '{"title":"x"}', ['pages is missing', 'climax is missing or empty'], 'story plan')
  assert.equal(repaired.length, 4)
  assert.equal(repaired[2].role, 'assistant')
  assert.equal(repaired[2].content, '{"title":"x"}')
  assert.match(repaired[3].content, /- pages is missing\n- climax is missing or empty/)
  assert.match(repaired[3].content, /complete corrected story plan as a single JSON object/)
  // original messages are not mutated
  assert.equal(original.length, 2)
  // very long bad output is truncated in the echo
  const huge = buildRepairMessages(original, 'x'.repeat(10_000), ['e'], 'book')
  assert.ok(huge[2].content.length < 7_000)
  assert.match(huge[2].content, /truncated/)
})

// ── 7. Stage 2 page-count mismatch ──────────────────────────────────────────

test('Stage 2 page-count mismatch is rejected; right count with bad numbering is renumbered', () => {
  const short = validateBook(makeBook(7), 8)
  assert.ok(!short.ok && short.errors.some(e => /exactly 8 are required/.test(e)))
  const long = validateBook(makeBook(9), 8)
  assert.equal(long.ok, false)

  const misnumbered = makeBook(8)
  ;(misnumbered.pages as { page: number }[]).forEach(p => { p.page = p.page + 10 })
  const fixed = validateBook(misnumbered, 8)
  assert.ok(fixed.ok)
  assert.deepEqual(fixed.ok && fixed.book.pages.map(p => p.page), [1, 2, 3, 4, 5, 6, 7, 8])

  const emptyText = makeBook(8)
  ;(emptyText.pages as { text: string }[])[2].text = ''
  const r = validateBook(emptyText, 8)
  assert.ok(!r.ok && r.errors.some(e => e === 'page 3: text is empty'))

  const noImage = makeBook(8)
  delete (noImage.pages as Record<string, unknown>[])[0].image_description
  const r2 = validateBook(noImage, 8)
  assert.ok(!r2.ok && r2.errors.some(e => /image_description is missing/.test(e)))

  assert.ok(!validateBook(makeBook(8, { title: '' }), 8).ok)
})

// ── 8. Phase 1B personalization survives into the planning prompt ───────────

test('personalization facts and guidance reach the planning prompt and the book prompt', () => {
  const [, planUser] = buildPlanPrompt(request(), {}, 'en')
  assert.match(planUser.content, /STORY FACTS/)
  assert.match(planUser.content, /Hero: Sofia, age 5/)
  assert.match(planUser.content, /Personality: curious, shy, protective/)
  assert.match(planUser.content, /Family notes: She sleeps with a stuffed triceratops called Tops\./)
  assert.match(planUser.content, /Supporting characters: her little brother Mateo/)
  assert.match(planUser.content, /the facts should shape the plot, not just appear in it/)
  assert.match(planUser.content, /produce the plan only/)

  const v = validateStoryPlan(makePlan(8), 8)
  assert.ok(v.ok)
  const [bookSystem, bookUser] = buildBookPrompt(request(), (v as { ok: true; plan: StoryPlan }).plan, {}, 'en')
  assert.match(bookUser.content, /STORY FACTS/)
  assert.match(bookUser.content, /Family notes: She sleeps with a stuffed triceratops called Tops\./)
  assert.match(bookUser.content, /STORY PLAN \(follow exactly/)
  assert.match(bookUser.content, /1\. \[setup\] On page 1 Sofia/)
  assert.match(bookUser.content, /Lesson \(show, never announce\): Courage is doing the scary thing/)
  assert.match(bookSystem.content, /Page N of your prose must realise page beat N/)
})

// ── 9. age rules survive into both stages ───────────────────────────────────

test('age-band rules and the personalization hierarchy are present in both stages', () => {
  const [planSystem] = buildPlanPrompt(request(), {}, 'en')
  assert.match(planSystem.content, /Age-band complexity rule:/)
  assert.match(planSystem.content, /Age-band pacing rule:/)
  assert.match(planSystem.content, /Plan complexity for this age: one simple causal chain/)
  assert.match(planSystem.content, /exactly 8 page beats/)
  assert.match(planSystem.content, /\(1\) safety and the output format, \(2\) the age-band rules/)
  assert.match(planSystem.content, /never a generic phrase like "The Magical Adventure"/)

  const v = validateStoryPlan(makePlan(8), 8)
  const [bookSystem] = buildBookPrompt(request(), (v as { ok: true; plan: StoryPlan }).plan, {}, 'en')
  assert.match(bookSystem.content, /Age-band length rule:/)
  assert.match(bookSystem.content, /Age-band complexity rule:/)
  assert.match(bookSystem.content, /Write exactly 8 story pages/)
  assert.match(bookSystem.content, /\(1\) safety and the output format, \(2\) the age-band rules/)

  // teen request gets the layered-conflict planning guidance
  const [teenSystem] = buildPlanPrompt({ ...request(), child_age: 14 }, {}, 'en')
  assert.match(teenSystem.content, /layered conflict \(an outer problem and an inner one\)/)
})

test('pacing guidance scales with page count and never fixes one phase per page', () => {
  const p8 = pacingGuidance(8, 'young')
  const p24 = pacingGuidance(24, 'middle')
  const p32 = pacingGuidance(32, 'middle')
  assert.match(p8, /8 page beats/)
  assert.match(p8, /1-2 pages of setup/)
  assert.match(p24, /10-13 pages of development/)
  assert.match(p32, /14-18 pages of development/)
  for (const p of [p8, p24, p32]) assert.match(p, /proportions, not a fixed page per phase/)
  assert.match(p8, /deepen the one problem/)
})

// ── 10. internal / private account data stays out ───────────────────────────

test('internal and account fields never reach the plan or book prompts', () => {
  const v = validateStoryPlan(makePlan(8), 8)
  const all = [
    ...buildPlanPrompt(request(), {}, 'en'),
    ...buildBookPrompt(request(), (v as { ok: true; plan: StoryPlan }).plan, {}, 'en'),
  ].map(m => m.content).join('\n')
  for (const leak of ['parent@example.com', '7d2c1e1a', 'story_pro', '203.0.113.9', 'w-123']) {
    assert.ok(!all.includes(leak), `prompt leaked ${leak}`)
  }
})

// ── 11. the plan never becomes reader content ───────────────────────────────

test('scene rows carry only page text and image prompts — no plan fields', () => {
  const b = validateBook(makeBook(3), 3)
  assert.ok(b.ok)
  const rows = toSceneRows((b as { ok: true; book: never }).book, { storyId: 's1', requestId: 'r1' })
  assert.equal(rows.length, 3)
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ['image_prompt', 'image_status', 'page_number', 'page_text', 'request_id', 'story_id'])
    assert.equal(row.image_status, 'pending')
  }
  const rendered = renderPlanForPrompt((validateStoryPlan(makePlan(8), 8) as { ok: true; plan: StoryPlan }).plan)
  assert.match(rendered, /Page beats/)
  assert.ok(!JSON.stringify(rows).includes('Page beats'))
})

// ── 12. downstream compatibility ────────────────────────────────────────────

test('validated book keeps the existing JSON contract fields the pipeline stores', () => {
  const b = validateBook(makeBook(8, { dedication: 'For Sofia', subtitle: 'A beach story' }), 8)
  assert.ok(b.ok)
  const book = (b as { ok: true; book: { title: string; subtitle: string; dedication: string; synopsis: string; pages: { page: number; text: string; image_description: string }[] } }).book
  assert.equal(book.title, 'The Triceratops Under the Tide')
  assert.equal(book.subtitle, 'A beach story')
  assert.equal(book.dedication, 'For Sofia')
  assert.equal(book.pages[0].page, 1)
  assert.equal(typeof book.pages[0].text, 'string')
  assert.equal(typeof book.pages[0].image_description, 'string')
})

test('usage totals sum when every stage reported tokens, else null', () => {
  const a = { prompt_tokens: 1000, completion_tokens: 2000, total_tokens: 3000, ms: 10, attempts: 1, model: 'gpt-4o' }
  const b = { prompt_tokens: 1500, completion_tokens: 4000, total_tokens: 5500, ms: 20, attempts: 1, model: 'gpt-4o' }
  assert.deepEqual(sumUsage([a, b]), { prompt_tokens: 2500, completion_tokens: 6000 })
  assert.deepEqual(sumUsage([a, { ...b, prompt_tokens: null }]), { prompt_tokens: null, completion_tokens: 6000 })
})

test('plan validation normalises numbering and defaults without inventing content', () => {
  const plan = makePlan(8)
  ;(plan.pages as { page: number; phase?: string }[]).forEach(p => { p.page = p.page + 100 })
  delete (plan as Record<string, unknown>).supporting_characters
  delete (plan as Record<string, unknown>).lesson
  const v = validateStoryPlan(plan, 8)
  assert.ok(v.ok)
  const out = (v as { ok: true; plan: StoryPlan }).plan
  assert.deepEqual(out.pages.map(p => p.page), [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(out.supporting_characters, [])
  assert.equal(out.lesson, '')
})
