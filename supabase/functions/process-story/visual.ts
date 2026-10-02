// Visual bible + per-page illustration prompt assembly (Phase 1E).
//
// Pure module: no Deno / Supabase / network. Imported by the Edge Function
// and exercised by Node tests (visual.test.ts).
//
// Design: the bible is DETERMINISTIC — built from data we already hold
// (the validated story plan, the request's name/age/description/supporting
// characters/style) plus a few invented, non-sensitive design choices
// (outfit colours and garments) picked by a stable hash of the request id.
// Building it twice from the same inputs yields byte-identical output, so a
// restarted worker, a continuation or an image-only retry can never produce
// a different protagonist design. It is also persisted
// (story_requests.visual_bible) for debugging and later cover work.
//
// Source hierarchy for a visual fact (highest wins):
//   1. explicit parent-provided visual cue (hair colour, glasses, favourite colour)
//   2. explicit story-plan requirement (setting, named characters, recurring objects)
//   3. established visual-bible fact (canonical outfit, art direction)
//   4. the page's plan continuity (temporary state: wet, coat, night)
//   5. the page's image_description (what happens in this picture)
//   6. model discretion
// Items 1-3 are frozen in the bible; 4 and 5 are added per page; the prompt
// tells the model that continuity describes temporary changes only.

import type { PlanBeat, StoryPlan } from './plan.ts'

export const VISUAL_BIBLE_VERSION = 1
/** DALL-E 3 accepts up to 4000 characters; keep headroom for provider rewrites. */
export const MAX_IMAGE_PROMPT_CHARS = 3600

export interface VisualProtagonist {
  name: string
  approximate_age: number | null
  /** Only cues the parent actually wrote (hair, glasses, favourite colour). Never invented. */
  parent_visual_cues: string[]
  /** Invented, non-sensitive, stable for the whole book. */
  canonical_outfit: string
  recurring_objects: string[]
}

export interface VisualSupporting {
  name: string
  role: string
  visual_description: string
  canonical_outfit: string
}

export interface VisualBible {
  version: number
  seed: string
  protagonist: VisualProtagonist
  supporting_characters: VisualSupporting[]
  setting: {
    core_environment: string
    recurring_locations: string[]
    important_objects: string[]
  }
  art_direction: {
    illustration_style: string
    style_hint: string
    palette_guidance: string
    lighting_guidance: string
    medium: string
    consistency_rules: string
  }
}

// ── Deterministic helpers ─────────────────────────────────────────────────────

/** Small stable 32-bit hash (FNV-1a) so the same seed always picks the same design. */
export function stableHash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

const pick = <T,>(list: readonly T[], seed: string, salt: string): T => list[stableHash(seed + '|' + salt) % list.length]

const COLOURS = ['red', 'yellow', 'green', 'blue', 'orange', 'purple', 'teal', 'pink'] as const
const COLOUR_RE = new RegExp(`\\b(${COLOURS.join('|')}|lilac|violet|turquoise|navy|gold|silver)\\b`, 'i')
const HAIR_RE = /\b((?:short|long|curly|straight|wavy|braided|messy|spiky|bouncy)\s+(?:brown|black|blond|blonde|red|ginger|dark|light|auburn|chestnut)?\s*hair|(?:brown|black|blond|blonde|red|ginger|dark|light|auburn|chestnut)\s+hair|(?:curly|straight|wavy|braided|spiky)\s+hair|pigtails|ponytail|braids|afro)\b/i
const GLASSES_RE = /\b(glasses|spectacles)\b/i
const FRECKLES_RE = /\bfreckles\b/i

/**
 * Pull only explicit, visually useful cues out of the parent's description.
 * Everything else in the description (interests, personality, family facts)
 * stays out of the image prompt.
 */
export function extractVisualCues(description: string | null | undefined): string[] {
  if (!description) return []
  const cues: string[] = []
  const hair = description.match(HAIR_RE)
  if (hair) cues.push(hair[1].toLowerCase().replace(/\s+/g, ' ').trim())
  if (GLASSES_RE.test(description)) cues.push('glasses')
  if (FRECKLES_RE.test(description)) cues.push('freckles')
  const colour = description.match(COLOUR_RE)
  if (colour) cues.push(`loves the colour ${colour[1].toLowerCase()}`)
  return cues
}

type SettingKind = 'jungle' | 'space' | 'ocean' | 'school' | 'fantasy' | 'city' | 'general'

function settingKind(text: string): SettingKind {
  const t = text.toLowerCase()
  if (/\b(jungle|forest|rainforest|woods)\b/.test(t)) return 'jungle'
  if (/\b(space|planet|rocket|star|moon|galaxy)\b/.test(t)) return 'space'
  if (/\b(ocean|sea|beach|underwater|reef|tide|wave)\b/.test(t)) return 'ocean'
  if (/\b(school|classroom|teacher|playground)\b/.test(t)) return 'school'
  if (/\b(kingdom|castle|dragon|knight|fairy|magic|wizard|enchanted)\b/.test(t)) return 'fantasy'
  if (/\b(city|street|neighbou?r|park|bus|subway|town)\b/.test(t)) return 'city'
  return 'general'
}

/** Ordinary, non-sensitive garment sets. {c} is replaced by the chosen colour. */
const OUTFITS: Record<SettingKind, readonly string[]> = {
  jungle: ['a {c} explorer shirt with khaki shorts and a wide-brimmed hat', 'a {c} t-shirt, green shorts and sturdy boots', 'a {c} vest over a striped shirt with rolled-up trousers'],
  space: ['a silver flight suit with {c} trim and a round helmet carried under one arm', 'a {c} spacesuit with white boots and a small backpack', 'a {c} jumpsuit with silver sleeves and a star patch'],
  ocean: ['a {c} raincoat with blue boots', 'a striped {c}-and-white shirt with rolled-up shorts and bare feet', 'a {c} swim shirt, shorts and a sun hat'],
  school: ['a {c} sweater over a white shirt with dark trousers', 'a {c} cardigan, a checked skirt-or-shorts and a small backpack', 'a {c} polo shirt with navy shorts and white trainers'],
  fantasy: ['a {c} tunic with a brown belt and a small satchel', 'a {c} hooded cloak over a simple cream shirt', 'a {c} jacket with patched elbows and soft leather boots'],
  city: ['a {c} hoodie with blue jeans and white trainers', 'a {c} jacket, grey trousers and a knitted beanie', 'a {c} t-shirt, denim dungarees and bright trainers'],
  general: ['a {c} hoodie with blue trousers', 'a {c} t-shirt with denim dungarees', 'a {c} jumper with corduroy trousers', 'a {c} striped top with dark shorts'],
}

const PALETTES: Record<SettingKind, string> = {
  jungle: 'deep greens, warm browns and bright accent flowers',
  space: 'deep navy and indigo with silver, soft white and one warm accent',
  ocean: 'sea blues and greens, sandy creams and warm sunset accents',
  school: 'warm neutrals with cheerful primary accents',
  fantasy: 'moss greens, stone greys, warm golds and twilight purples',
  city: 'warm greys and brick reds with bright signage accents',
  general: 'a warm, cohesive palette of four or five main colours',
}

const ART_BY_STYLE: Record<string, { medium: string; lighting: string }> = {
  watercolor: { medium: 'soft watercolor on textured paper with visible washes and gentle edges', lighting: 'soft, diffused daylight with gentle shadows' },
  cartoon: { medium: 'clean cartoon linework with flat bright fills and bold outlines', lighting: 'even, bright and cheerful' },
  storybook: { medium: 'classic painted storybook illustration with warm, detailed brushwork', lighting: 'warm golden-hour light with soft depth' },
  pencil_sketch: { medium: 'hand-drawn pencil with soft graphite shading and light colour washes', lighting: 'gentle natural light, soft contrast' },
  digital_art: { medium: 'polished digital painting with smooth gradients and crisp shapes', lighting: 'clear, vibrant lighting with soft rim light' },
}

export const DEFAULT_CONSISTENCY_RULES =
  'Same illustrated book on every page: identical character designs, proportions and outfits unless a page note says otherwise; one consistent medium, palette and level of detail; compositions may vary freely (wide, close, action, quiet) to suit the moment.'

// ── Proper-noun detection for recurring objects ───────────────────────────────

const STOP = new Set(['The', 'A', 'An', 'And', 'But', 'Then', 'When', 'She', 'He', 'They', 'It', 'Her', 'His', 'Their', 'As', 'At', 'In', 'On', 'With', 'Page', 'Now', 'Later', 'Meanwhile', 'Suddenly', 'Once', 'Carry', 'Keep'])

function properNouns(text: string): string[] {
  const out: string[] = []
  const sentences = text.split(/(?<=[.!?;:])\s+/)
  for (const s of sentences) {
    const words = s.split(/\s+/)
    words.forEach((w, i) => {
      const clean = w.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, '')
      if (!clean || i === 0) return
      if (/^[A-Z][a-z]{2,}$/.test(clean) && !STOP.has(clean)) out.push(clean)
    })
  }
  return out
}

function recurringProperNouns(plan: StoryPlan | null, exclude: Set<string>, minPages = 3, max = 3): string[] {
  if (!plan) return []
  const counts = new Map<string, Set<number>>()
  for (const b of plan.pages) {
    for (const noun of new Set(properNouns(`${b.beat} ${b.continuity}`))) {
      if (exclude.has(noun.toLowerCase())) continue
      if (!counts.has(noun)) counts.set(noun, new Set())
      counts.get(noun)!.add(b.page)
    }
  }
  return [...counts.entries()]
    .filter(([, pages]) => pages.size >= minPages)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([noun]) => noun)
}

// ── Builder ───────────────────────────────────────────────────────────────────

export interface VisualBibleInput {
  requestId: string
  childName: string
  childAge: number | null
  childDescription?: string | null
  supportingCharactersText?: string | null
  illustrationStyle: string
  styleHint: string
  plan: StoryPlan | null
  consistencyRules?: string | null
}

function supportingVisual(name: string, rawRole: string, colour: string, seed: string): { visual_description: string; canonical_outfit: string } {
  // "little brother" → "the little brother"; "a friend" stays as written.
  const role = /^(a|an|the|his|her|their|sofia's|[A-Z][a-z]+'s)\b/i.test(rawRole.trim()) || !rawRole.trim() ? rawRole.trim() : `the ${rawRole.trim()}`
  const r = role.toLowerCase()
  if (/\b(brother|sister|cousin|friend|classmate|neighbou?r|toddler|baby)\b/.test(r)) {
    const younger = /\b(little|younger|baby|toddler)\b/.test(r)
    return {
      visual_description: `${younger ? 'a smaller, younger child' : 'a child about the same age'} who is ${role}`,
      canonical_outfit: pick([`a ${colour} t-shirt with shorts`, `a ${colour} striped top with dungarees`, `a ${colour} hoodie with trousers`], seed, name),
    }
  }
  if (/\b(mum|mom|mother|dad|father|grandma|grandmother|grandpa|grandfather|teacher|aunt|uncle|captain|keeper|guard|librarian)\b/.test(r)) {
    return { visual_description: `an adult who is ${role}`, canonical_outfit: pick([`a ${colour} cardigan`, `a ${colour} jacket`, `a ${colour} apron over a plain shirt`], seed, name) }
  }
  if (/\b(dog|puppy|cat|kitten|rabbit|bunny|bird|owl|fox|bear|horse|pony|turtle|fish|hamster)\b/.test(r)) {
    const animal = r.match(/\b(dog|puppy|cat|kitten|rabbit|bunny|bird|owl|fox|bear|horse|pony|turtle|fish|hamster)\b/)![1]
    return { visual_description: `a friendly ${animal}`, canonical_outfit: `a ${colour} collar or ribbon` }
  }
  if (/\b(dragon|robot|monster|alien|fairy|wizard|witch|giant|creature|elf|knight|pirate)\b/.test(r)) {
    const kind = r.match(/\b(dragon|robot|monster|alien|fairy|wizard|witch|giant|creature|elf|knight|pirate)\b/)![1]
    return { visual_description: `a friendly, child-safe ${kind}`, canonical_outfit: `with ${colour} as its signature colour` }
  }
  return { visual_description: role || 'a supporting character', canonical_outfit: `a ${colour} jacket` }
}

/** Parse the parent's free-text supporting characters ("her little brother Mateo, Grandma Joyce"). */
export function parseSupportingText(text: string | null | undefined): { name: string; role: string }[] {
  if (!text) return []
  const out: { name: string; role: string }[] = []
  for (const part of text.split(/[,;]|\band\b/i)) {
    const p = part.trim()
    if (!p) continue
    const m = p.match(/\b([A-Z][a-z]{1,30})\b/)
    const name = m ? m[1] : ''
    const role = p.replace(name, '').replace(/\s+/g, ' ').replace(/^(his|her|their|the)\s+/i, '').trim()
    if (name) out.push({ name, role: role || 'a companion' })
  }
  return out
}

export function buildVisualBible(input: VisualBibleInput): VisualBible {
  // The seed is a hash of the request id + name: deterministic for the
  // story, but the raw request id itself is not stored in the bible.
  const seed = stableHash(`${input.requestId}|${input.childName}`).toString(16)
  const name = input.childName.trim() || 'the hero'
  const cues = extractVisualCues(input.childDescription)
  const favourite = cues.find(c => c.startsWith('loves the colour '))?.replace('loves the colour ', '')
  const heroColour = favourite && (COLOURS as readonly string[]).includes(favourite) ? favourite : pick(COLOURS, seed, 'hero-colour')

  const settingText = `${input.plan?.setting ?? ''} ${input.plan?.premise ?? ''}`
  const kind = settingKind(settingText)
  const outfit = pick(OUTFITS[kind], seed, 'hero-outfit').replace('{c}', heroColour)

  // Supporting characters: plan first (authoritative roles), then any the
  // parent named that the plan did not carry. Names are matched case-insensitively.
  const seen = new Set<string>([name.toLowerCase()])
  const supporting: VisualSupporting[] = []
  const candidates = [
    ...(input.plan?.supporting_characters ?? []),
    ...parseSupportingText(input.supportingCharactersText),
  ]
  for (const c of candidates) {
    const n = c.name.trim()
    if (!n || seen.has(n.toLowerCase())) continue
    seen.add(n.toLowerCase())
    const colour = COLOURS.filter(x => x !== heroColour)[stableHash(seed + '|sc|' + n) % (COLOURS.length - 1)]
    const v = supportingVisual(n, c.role, colour, seed)
    supporting.push({ name: n, role: c.role, ...v })
    if (supporting.length >= 4) break
  }

  const recurring = recurringProperNouns(input.plan, seen)
  const art = ART_BY_STYLE[input.illustrationStyle] ?? ART_BY_STYLE.storybook

  return {
    version: VISUAL_BIBLE_VERSION,
    seed,
    protagonist: {
      name,
      approximate_age: Number.isFinite(Number(input.childAge)) && Number(input.childAge) < 18 ? Number(input.childAge) : null,
      parent_visual_cues: cues.filter(c => !c.startsWith('loves the colour ')),
      canonical_outfit: outfit,
      recurring_objects: recurring,
    },
    supporting_characters: supporting,
    setting: {
      core_environment: (input.plan?.setting ?? '').trim(),
      recurring_locations: [],
      important_objects: recurring,
    },
    art_direction: {
      illustration_style: input.illustrationStyle,
      style_hint: input.styleHint,
      palette_guidance: PALETTES[kind],
      lighting_guidance: art.lighting,
      medium: art.medium,
      consistency_rules: input.consistencyRules?.trim() || DEFAULT_CONSISTENCY_RULES,
    },
  }
}

export type BibleValidation = { ok: true; bible: VisualBible } | { ok: false; errors: string[] }

export function validateVisualBible(raw: unknown): BibleValidation {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['visual bible is not an object'] }
  const b = raw as Record<string, unknown>
  if (b.version !== VISUAL_BIBLE_VERSION) errors.push('visual bible version mismatch')
  const p = (b.protagonist ?? {}) as Record<string, unknown>
  if (typeof p.name !== 'string' || !p.name.trim()) errors.push('protagonist.name missing')
  if (typeof p.canonical_outfit !== 'string' || !p.canonical_outfit.trim()) errors.push('protagonist.canonical_outfit missing')
  const a = (b.art_direction ?? {}) as Record<string, unknown>
  if (typeof a.illustration_style !== 'string' || !a.illustration_style) errors.push('art_direction.illustration_style missing')
  if (typeof a.style_hint !== 'string' || !a.style_hint) errors.push('art_direction.style_hint missing')
  if (!Array.isArray(b.supporting_characters)) errors.push('supporting_characters missing')
  if (errors.length) return { ok: false, errors }
  return { ok: true, bible: raw as VisualBible }
}

// ── Per-page prompt ───────────────────────────────────────────────────────────

export function findPlanPage(plan: StoryPlan | null | undefined, pageNumber: number): PlanBeat | null {
  if (!plan) return null
  return plan.pages.find(p => p.page === pageNumber) ?? null
}

const nameRe = (name: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s)?\\b`, 'i')

export function protagonistAnchor(b: VisualBible): string {
  const p = b.protagonist
  const parts: string[] = []
  parts.push(`${p.name} is ${p.approximate_age ? `a ${p.approximate_age}-year-old child` : 'the main character'}`)
  if (p.parent_visual_cues.length) parts.push(`with ${p.parent_visual_cues.join(', ')}`)
  parts.push(`wearing ${p.canonical_outfit}`)
  if (p.recurring_objects.length) parts.push(`(recurring objects: ${p.recurring_objects.join(', ')})`)
  return `${parts.join(' ')}; keep ${p.name}'s face, hair, build and outfit identical to every other page of this book`
}

export function supportingAnchor(s: VisualSupporting): string {
  return `${s.name} is ${s.visual_description}, ${s.canonical_outfit}; keep ${s.name} identical across pages`
}

export interface ImagePromptArgs {
  bible: VisualBible
  pageNumber: number
  imageDescription: string
  planPage: PlanBeat | null
  bandImageHint?: string
  safetySuffix: string
  maxChars?: number
}

export interface ImagePromptMeta {
  page_number: number
  prompt_length: number
  character_anchor_count: number
  protagonist_anchor: boolean
  /** Count only — never the family members' names (privacy). */
  supporting_present_count: number
  continuity_used: boolean
  truncated: boolean
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

/**
 * Final illustration prompt for one page.
 * Order (what the provider sees first matters most):
 *   style + medium → the scene → character anchors present → page continuity
 *   → book world + palette + lighting → consistency rule → band hint → safety.
 */
export function buildImagePrompt(args: ImagePromptArgs): { prompt: string; meta: ImagePromptMeta } {
  const b = args.bible
  const max = args.maxChars ?? MAX_IMAGE_PROMPT_CHARS
  const desc = args.imageDescription.replace(/\s+/g, ' ').trim()
  const beatText = args.planPage ? `${args.planPage.beat} ${args.planPage.continuity}` : ''
  const presenceText = `${desc} ${beatText}`

  const supportingPresent = b.supporting_characters.filter(s => nameRe(s.name).test(presenceText))
  // The hero is the default subject: present when named, or when no other known character is named.
  const protagonistPresent = nameRe(b.protagonist.name).test(presenceText) || supportingPresent.length === 0

  const anchors: string[] = []
  if (protagonistPresent) anchors.push(protagonistAnchor(b))
  for (const s of supportingPresent) anchors.push(supportingAnchor(s))

  const continuity = args.planPage?.continuity?.trim() ?? ''
  const world = [
    b.setting.core_environment ? `Book world: ${b.setting.core_environment}` : '',
    b.setting.important_objects.length ? `important objects: ${b.setting.important_objects.join(', ')}` : '',
  ].filter(Boolean).join('; ')

  let truncated = false
  const clipT = (s: string, n: number) => { if (s.length > n) { truncated = true; return clip(s, n) } return s }

  const sections = (limits: { desc: number; anchor: number; cont: number; world: number }) => [
    `${b.art_direction.style_hint}; ${b.art_direction.medium}.`,
    `Scene: ${clipT(desc, limits.desc)}`,
    anchors.length ? `Characters in this scene: ${anchors.map(a => clipT(a, limits.anchor)).join('. ')}.` : '',
    continuity ? `Page continuity (temporary state for this page only — everything else stays as in the character anchors): ${clipT(continuity, limits.cont)}` : '',
    world ? `${clipT(world, limits.world)}. Palette: ${b.art_direction.palette_guidance}. Lighting: ${b.art_direction.lighting_guidance}.` : `Palette: ${b.art_direction.palette_guidance}. Lighting: ${b.art_direction.lighting_guidance}.`,
    b.art_direction.consistency_rules,
    args.bandImageHint?.trim() ? `${args.bandImageHint.trim()}.` : '',
    args.safetySuffix,
  ].filter(Boolean).join(' ')

  // Bounded: tighten the least important parts first, never the safety suffix.
  const ladder = [
    { desc: 900, anchor: 320, cont: 300, world: 300 },
    { desc: 700, anchor: 240, cont: 200, world: 200 },
    { desc: 500, anchor: 180, cont: 140, world: 120 },
    { desc: 350, anchor: 140, cont: 100, world: 80 },
  ]
  let prompt = sections(ladder[0])
  for (let i = 1; i < ladder.length && prompt.length > max; i++) {
    prompt = sections(ladder[i])
  }
  if (prompt.length > max) {
    // Last resort: hard cut before the safety suffix and re-append it.
    const safety = ` ${args.safetySuffix}`
    prompt = prompt.slice(0, max - safety.length).trimEnd() + safety
    truncated = true
  }

  return {
    prompt,
    meta: {
      page_number: args.pageNumber,
      prompt_length: prompt.length,
      character_anchor_count: anchors.length,
      protagonist_anchor: protagonistPresent,
      supporting_present_count: supportingPresent.length,
      continuity_used: continuity.length > 0,
      truncated,
    },
  }
}

// ── Cover (Phase 1F) ──────────────────────────────────────────────────────────
//
// One front-cover illustration per completed illustrated story, built
// deterministically from the SAME persisted visual bible and plan the
// interior used. No text is ever requested inside the image: the title,
// author line and attribution stay application typography (reader + PDF).

export const COVER_FILENAME = 'cover.png'
export function coverStoragePath(requestId: string): string {
  return `${requestId}/${COVER_FILENAME}`
}

/** Mood + composition direction derived from the parent's tone choices (never from climax/resolution). */
export function coverMoodFromTones(tones: readonly string[] | string | null | undefined): { mood: string; composition: string } {
  const list = (Array.isArray(tones) ? tones : String(tones ?? '').split(',')).map(t => t.trim().toLowerCase()).filter(Boolean)
  const has = (...ks: string[]) => ks.some(k => list.includes(k))
  if (has('adventurous', 'brave', 'suspenseful', 'dramatic')) {
    return { mood: 'energetic adventure and resolve', composition: 'the hero mid-motion, setting off into the world of the story with the setting opening up behind or ahead of them' }
  }
  if (has('magical', 'inspiring')) {
    return { mood: 'wonder and discovery', composition: 'the hero gazing at or reaching toward something luminous and inviting from the story world, scale showing how big the world feels' }
  }
  if (has('funny', 'silly')) {
    return { mood: 'playful humour', composition: 'the hero caught in an amusing moment with the story\'s key object or companion, expressive and lively' }
  }
  if (has('calm', 'heartwarming', 'emotional', 'romantic')) {
    return { mood: 'warmth and quiet closeness', composition: 'the hero in a gentle, intimate moment within the setting, soft and inviting' }
  }
  return { mood: 'warm curiosity', composition: 'the hero clearly centred in the story world, inviting the reader in' }
}

/** Supporting characters that matter to the whole story (present in ≥ 40% of beats), max two. */
export function relevantSupportingForCover(bible: VisualBible, plan: StoryPlan | null): VisualSupporting[] {
  if (!plan || plan.pages.length === 0) return []
  const n = plan.pages.length
  return bible.supporting_characters
    .map(s => ({ s, hits: plan.pages.filter(p => nameRe(s.name).test(`${p.beat} ${p.continuity}`)).length }))
    .filter(x => x.hits / n >= 0.4)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map(x => x.s)
}

export const COVER_NO_TEXT_RULE =
  'Absolutely no text of any kind in the image: no title, no words, no letters, no numbers, no signs or labels with readable writing, no logos, no watermark, no decorative border or frame.'

export interface CoverPromptArgs {
  bible: VisualBible
  plan: StoryPlan | null
  tones?: readonly string[] | string | null
  bandImageHint?: string
  safetySuffix: string
  maxChars?: number
}

export interface CoverPromptMeta {
  prompt_length: number
  character_anchor_count: number
  /** Count only — never the family members' names (privacy). */
  supporting_present_count: number
  truncated: boolean
  mood: string
}

/**
 * Deterministic front-cover prompt: the book as a whole, not page 1, and
 * never the ending. Order: style + medium → cover framing → subject
 * (hero anchor + relevant companions) → the story (premise, setting,
 * mood) → composition with typography space → palette/lighting →
 * consistency → band hint → no-text rule → safety.
 */
export function buildCoverPrompt(args: CoverPromptArgs): { prompt: string; meta: CoverPromptMeta } {
  const b = args.bible
  const max = args.maxChars ?? MAX_IMAGE_PROMPT_CHARS
  const { mood, composition } = coverMoodFromTones(args.tones)
  const companions = relevantSupportingForCover(b, args.plan)
  const anchors = [protagonistAnchor(b), ...companions.map(supportingAnchor)]
  const premise = (args.plan?.premise ?? '').trim()
  const setting = (args.plan?.setting ?? b.setting.core_environment ?? '').trim()
  const arcStart = (args.plan?.emotional_arc ?? '').split(/→|->|,|;/)[0]?.trim() ?? ''
  const objects = b.protagonist.recurring_objects

  let truncated = false
  const clipT = (s: string, n: number) => { if (s.length > n) { truncated = true; return clip(s, n) } return s }

  const sections = (limits: { premise: number; anchor: number; setting: number }) => [
    `${b.art_direction.style_hint}; ${b.art_direction.medium}.`,
    'Children\'s picture-book FRONT COVER illustration — a single strong image that captures the promise of the whole story, not a scene from one page.',
    `Subject: ${anchors.map(a => clipT(a, limits.anchor)).join('. ')}.`,
    premise ? `The story: ${clipT(premise, limits.premise)}` : '',
    setting ? `Setting: ${clipT(setting, limits.setting)}.` : '',
    `Mood: ${mood}${arcStart ? `, beginning from ${arcStart.toLowerCase()}` : ''}.`,
    objects.length ? `Include ${objects.join(' and ')} as a visible motif.` : '',
    `Composition: ${composition}; strong focal hierarchy with ${b.protagonist.name} clearly readable as the main figure; inviting and polished; leave calm, uncluttered space in the upper third of the frame for the title and a quiet band along the bottom for the author line; do not show the ending of the story.`,
    `Palette: ${b.art_direction.palette_guidance}. Lighting: ${b.art_direction.lighting_guidance}.`,
    b.art_direction.consistency_rules,
    args.bandImageHint?.trim() ? `${args.bandImageHint.trim()}.` : '',
    COVER_NO_TEXT_RULE,
    args.safetySuffix,
  ].filter(Boolean).join(' ')

  const ladder = [
    { premise: 500, anchor: 320, setting: 200 },
    { premise: 350, anchor: 240, setting: 140 },
    { premise: 220, anchor: 180, setting: 100 },
  ]
  let prompt = sections(ladder[0])
  for (let i = 1; i < ladder.length && prompt.length > max; i++) prompt = sections(ladder[i])
  if (prompt.length > max) {
    const tail = ` ${COVER_NO_TEXT_RULE} ${args.safetySuffix}`
    prompt = prompt.slice(0, max - tail.length).trimEnd() + tail
    truncated = true
  }

  return {
    prompt,
    meta: {
      prompt_length: prompt.length,
      character_anchor_count: anchors.length,
      supporting_present_count: companions.length,
      truncated,
      mood,
    },
  }
}

export type CoverDecision = 'skip' | 'reuse' | 'generate'

/** Idempotent decision: an existing complete cover is always reused; images-off skips. */
export function shouldGenerateCover(row: { cover_status?: string | null; cover_storage_path?: string | null } | null | undefined, imagesSkipped: boolean): CoverDecision {
  if (row?.cover_status === 'complete' && row.cover_storage_path) return 'reuse'
  if (imagesSkipped) return 'skip'
  return 'generate'
}

/** The only fields a cover failure may touch — never scenes, never completion. */
export function coverFailureUpdate(message: string, attempts: number): { cover_status: 'failed'; cover_last_error: string; cover_attempts: number } {
  return { cover_status: 'failed', cover_last_error: message.slice(0, 500), cover_attempts: attempts }
}
