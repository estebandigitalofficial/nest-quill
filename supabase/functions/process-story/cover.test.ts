// Run: node --experimental-strip-types --test supabase/functions/process-story/cover.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  COVER_NO_TEXT_RULE,
  MAX_IMAGE_PROMPT_CHARS,
  buildCoverPrompt,
  buildImagePrompt,
  buildVisualBible,
  coverFailureUpdate,
  coverMoodFromTones,
  coverStoragePath,
  findPlanPage,
  protagonistAnchor,
  relevantSupportingForCover,
  shouldGenerateCover,
  validateVisualBible,
} from './visual.ts'
import { validateStoryPlan, type StoryPlan } from './plan.ts'

function makePlan(pageCount = 8): StoryPlan {
  const pages = Array.from({ length: pageCount }, (_, i) => {
    const n = i + 1
    return {
      page: n,
      phase: n === 1 ? 'setup' : n === 2 ? 'inciting' : n === pageCount - 1 ? 'climax' : n === pageCount ? 'resolution' : 'development',
      beat: n % 2 === 0 ? `Sofia and Mateo search pool ${n} for Tops.` : `Sofia searches pool ${n} for Tops; Grandma watches from far away.`,
      purpose: 'Advance the search.',
      development: '',
      continuity: `Tops still missing after pool ${n}.`,
    }
  })
  const v = validateStoryPlan({
    title: 'The Triceratops Under the Tide',
    premise: 'Sofia loses her stuffed triceratops at the beach and must brave the rock pools to find it before the tide comes in.',
    protagonist: { name: 'Sofia', characterization: 'Curious but shy; protective of Mateo.', want: 'Tops back before dark.' },
    supporting_characters: [{ name: 'Mateo', role: 'little brother' }, { name: 'Grandma', role: 'grandmother at the beach house' }],
    setting: 'A rocky beach at low tide with glittering rock pools',
    central_conflict: 'The tide is rising and Tops is in the pools.',
    goal: 'Find Tops before the tide covers the pools.',
    emotional_arc: 'Worried → scared → brave → proud.',
    beginning_state: 'A happy beach day.',
    escalation: 'Each pool is deeper; the light fades.',
    climax: 'Sofia wades into the deepest pool herself and grabs Tops before a wave takes it.',
    resolution: 'Tops is wet but safe; Sofia carries Mateo back up the beach.',
    ending_state: 'Sofia trusts herself near the water.',
    lesson: '',
    pages,
  }, pageCount)
  assert.ok(v.ok)
  return (v as { ok: true; plan: StoryPlan }).plan
}

const SAFETY = 'Child-safe, no text, no words in image.'
const bible = () => buildVisualBible({
  requestId: '7d2c1e1a-0000-4000-8000-000000000001',
  childName: 'Sofia',
  childAge: 5,
  childDescription: 'Loves dinosaurs, obsessed with the colour purple, curly brown hair, email parent@example.com',
  supportingCharactersText: 'her little brother Mateo',
  illustrationStyle: 'watercolor',
  styleHint: "soft watercolor illustration, gentle washes of color, children's picture book style",
  plan: makePlan(),
})

test('1. the cover uses the identical protagonist anchor the interior pages use', () => {
  const b = bible()
  const plan = makePlan()
  const anchor = protagonistAnchor(b)
  const cover = buildCoverPrompt({ bible: b, plan, tones: ['magical', 'brave'], safetySuffix: SAFETY })
  const page = buildImagePrompt({ bible: b, pageNumber: 3, imageDescription: 'Sofia at pool 3.', planPage: findPlanPage(plan, 3), safetySuffix: SAFETY })
  assert.ok(cover.prompt.includes(anchor))
  assert.ok(page.prompt.includes(anchor))
})

test('2. the cover uses the persisted art direction (style, medium, palette, lighting, consistency)', () => {
  const b = bible()
  const { prompt } = buildCoverPrompt({ bible: b, plan: makePlan(), tones: ['magical'], safetySuffix: SAFETY })
  assert.match(prompt, /^soft watercolor illustration, gentle washes of color, children's picture book style; soft watercolor on textured paper/)
  assert.match(prompt, /Palette: sea blues and greens/)
  assert.match(prompt, /Lighting: soft, diffused daylight/)
  assert.match(prompt, /Same illustrated book on every page/)
})

test('3 & 4. the cover never asks for the title or author and explicitly prohibits lettering', () => {
  const { prompt } = buildCoverPrompt({ bible: bible(), plan: makePlan(), tones: ['funny'], safetySuffix: SAFETY })
  assert.ok(!prompt.includes('The Triceratops Under the Tide'))
  assert.doesNotMatch(prompt, /render the title|write the title|author name|Nest & Quill/i)
  assert.ok(prompt.includes(COVER_NO_TEXT_RULE))
  assert.match(prompt, /no title, no words, no letters/)
  assert.ok(prompt.endsWith(SAFETY))
  // the cover represents the whole story and avoids the ending
  assert.match(prompt, /captures the promise of the whole story, not a scene from one page/)
  assert.match(prompt, /do not show the ending of the story/)
  assert.ok(!prompt.includes('grabs Tops before a wave'))
  assert.ok(!prompt.includes('carries Mateo back up the beach'))
})

test('5. private, account and worker fields never enter the cover prompt or bible', () => {
  const b = bible()
  const { prompt } = buildCoverPrompt({ bible: b, plan: makePlan(), tones: ['calm'], safetySuffix: SAFETY })
  for (const leak of ['parent@example.com', '7d2c1e1a', 'story_pro', '203.0.113.9', 'worker', 'lease', 'stripe', 'dinosaurs']) {
    assert.ok(!(prompt + JSON.stringify(b)).toLowerCase().includes(leak), `leaked ${leak}`)
  }
})

test('6. the cover prompt is bounded and keeps the no-text rule and safety suffix when truncated', () => {
  const b = bible()
  const plan = makePlan()
  plan.premise = 'Sofia loses Tops. '.repeat(400)
  const { prompt, meta } = buildCoverPrompt({ bible: b, plan, tones: ['brave'], safetySuffix: SAFETY, maxChars: 1200 })
  assert.ok(prompt.length <= 1200)
  assert.equal(meta.truncated, true)
  assert.ok(prompt.endsWith(SAFETY))
  assert.ok(prompt.includes(COVER_NO_TEXT_RULE))
  const normal = buildCoverPrompt({ bible: b, plan: makePlan(), tones: ['brave'], safetySuffix: SAFETY })
  assert.ok(normal.meta.prompt_length <= MAX_IMAGE_PROMPT_CHARS && !normal.meta.truncated)
})

test('7 & 8. an existing complete cover is reused; a continuation never generates a second one', () => {
  assert.equal(shouldGenerateCover({ cover_status: 'complete', cover_storage_path: 'r/cover.png' }, false), 'reuse')
  assert.equal(shouldGenerateCover({ cover_status: 'complete', cover_storage_path: 'r/cover.png' }, true), 'reuse')
  assert.equal(shouldGenerateCover({ cover_status: 'generating', cover_storage_path: null }, false), 'generate')
  assert.equal(shouldGenerateCover({ cover_status: 'failed', cover_storage_path: null }, false), 'generate')
  assert.equal(shouldGenerateCover(null, false), 'generate')
})

test('9. images disabled → cover skipped, never a broken asset', () => {
  assert.equal(shouldGenerateCover(null, true), 'skip')
  assert.equal(shouldGenerateCover({ cover_status: 'failed' }, true), 'skip')
})

test('10. a cover failure touches cover fields only — never scenes or completion', () => {
  const update = coverFailureUpdate('DALL-E error 429: rate limit', 2)
  assert.deepEqual(Object.keys(update).sort(), ['cover_attempts', 'cover_last_error', 'cover_status'])
  assert.equal(update.cover_status, 'failed')
  assert.equal(update.cover_attempts, 2)
  assert.ok(!('image_status' in update) && !('status' in update))
})

test('14. retry / backfill builds the same cover prompt from the same persisted bible', () => {
  const b = bible()
  const persisted = validateVisualBible(JSON.parse(JSON.stringify(b)))
  assert.ok(persisted.ok)
  const a = buildCoverPrompt({ bible: b, plan: makePlan(), tones: ['brave'], safetySuffix: SAFETY })
  const c = buildCoverPrompt({ bible: (persisted as { ok: true; bible: typeof b }).bible, plan: makePlan(), tones: ['brave'], safetySuffix: SAFETY })
  assert.equal(a.prompt, c.prompt)
  assert.equal(coverStoragePath('abc'), 'abc/cover.png')
})

test('relevant companions: Mateo (half the beats) is on the cover, Grandma is also frequent; a rare character is not', () => {
  const b = bible()
  const plan = makePlan()
  const names = relevantSupportingForCover(b, plan).map(s => s.name)
  assert.ok(names.includes('Mateo'))
  const sparse = makePlan()
  sparse.pages.forEach(p => { p.beat = p.beat.replace('Mateo', 'nobody').replace('Grandma', 'nobody') })
  sparse.pages[0].beat = 'Sofia and Mateo at the beach.'
  assert.deepEqual(relevantSupportingForCover(b, sparse), [])
  assert.deepEqual(relevantSupportingForCover(b, null), [])
})

test('mood follows the tones chosen in the wizard, never the climax', () => {
  assert.equal(coverMoodFromTones(['adventurous']).mood, 'energetic adventure and resolve')
  assert.equal(coverMoodFromTones('magical, brave').mood, 'energetic adventure and resolve')
  assert.equal(coverMoodFromTones(['magical']).mood, 'wonder and discovery')
  assert.equal(coverMoodFromTones(['silly']).mood, 'playful humour')
  assert.equal(coverMoodFromTones(['calm']).mood, 'warmth and quiet closeness')
  assert.equal(coverMoodFromTones(null).mood, 'warm curiosity')
})
