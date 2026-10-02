// Visual bible + per-page illustration prompt assembly (Phase 1E, 1H).
//
// Pure module: no Deno / Supabase / network. Imported by the Edge Function
// and exercised by Node tests (visual.test.ts, fidelity.test.ts).
//
// Design: the bible is DETERMINISTIC — built from data we already hold
// (the validated story plan, the request's name/age/description/supporting
// characters/notes/style) plus a few invented, non-sensitive design choices
// picked by a stable hash of the request id, used ONLY where the parent
// supplied nothing. Building it twice from the same inputs yields
// byte-identical output, so a restarted worker, a continuation or an
// image-only retry can never produce a different design. It is persisted
// (story_requests.visual_bible) and reused as-is by every later run.
//
// Precedence for a visual fact (higher wins, lower may never overwrite):
//   1. the parent's own visual description (hair, skin, features, clothing,
//      species, colour/markings) — kept verbatim as facts
//   2. other explicit parent facts (supporting-character roles, named objects)
//   3. persisted story-plan facts that do not contradict 1-2 (setting, roles)
//   4. deterministically inferred details (setting palette, medium)
//   5. safe invented defaults only where no fact exists (missing garments)
// 1-5 are frozen in the bible; a page adds only its plan continuity
// (temporary state) and its image_description (what happens in the picture).

import type { PlanBeat, StoryPlan } from './plan.ts'
import {
  type Appearance,
  appearanceSummary,
  extractExplicitObjects,
  parseAppearance,
  parseSupportingEntries,
  sameCharacter,
  withArticle,
} from './appearance.ts'

export const VISUAL_BIBLE_VERSION = 2
/** Bibles persisted by Phase 1E (v1) stay valid and are read through the same anchors. */
export const SUPPORTED_BIBLE_VERSIONS: readonly number[] = [1, 2]
/** GPT Image / DALL-E 3 accept up to 4000 characters; keep headroom for provider rewrites. */
export const MAX_IMAGE_PROMPT_CHARS = 3600

export interface VisualIdentity {
  kind: 'human' | 'animal' | 'creature'
  /** Hard invariant when the parent named one ("cat", "parrot"). */
  species: string | null
  /** Colour words and markings in the parent's words ("black", "one white paw"). */
  markings: string[]
}

export interface VisualOutfit {
  /** Garments the parent wrote, verbatim — never replaced. */
  explicit: string[]
  /** Garments invented only for slots the parent left empty. */
  invented: string[]
}

export interface VisualProtagonist {
  name: string
  approximate_age: number | null
  /** Explicit parent cues, order-stable (hair, accessories, eyes, glasses, features; skin only when supplied). Never invented. */
  parent_visual_cues: string[]
  /** Full outfit sentence = explicit garments first, then invented fillers. */
  canonical_outfit: string
  recurring_objects: string[]
  /** v2: structured facts behind the strings above. */
  identity?: VisualIdentity
  appearance?: Appearance
  outfit?: VisualOutfit
}

export interface VisualSupporting {
  name: string
  role: string
  visual_description: string
  canonical_outfit: string
  /** v2 */
  identity?: VisualIdentity
  appearance?: Appearance
  outfit?: VisualOutfit
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

/**
 * Explicit, visually useful cues from the parent's description, in the
 * parent's words. Everything else (interests, personality, family facts,
 * contact details) stays out of the image prompt. Favourite colour is
 * returned separately by parseAppearance and is never a cue.
 */
export function extractVisualCues(description: string | null | undefined): string[] {
  return appearanceSummary(parseAppearance(description, { subject: 'protagonist' }))
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
  city: ['a {c} hoodie with blue jeans and white trainers', 'a {c} jacket, grey trousers and a knitted beanie', 'a {c} t-shirt, full-length denim dungarees and bright trainers'],
  general: ['a {c} hoodie with blue trousers', 'a {c} t-shirt with full-length denim dungarees', 'a {c} jumper with corduroy trousers', 'a {c} striped top with dark shorts'],
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

// ── Recurring objects ─────────────────────────────────────────────────────────

const STOP = new Set(['The', 'A', 'An', 'And', 'But', 'Then', 'When', 'She', 'He', 'They', 'It', 'Her', 'His', 'Their', 'As', 'At', 'In', 'On', 'With', 'Page', 'Now', 'Later', 'Meanwhile', 'Suddenly', 'Once', 'Carry', 'Keep'])
const ROLE_WORDS = /^(?:mum|mom|mother|dad|father|grandma|grandmother|grandpa|grandfather|nana|granny|abuela|abuelo|aunt|auntie|uncle|tio|tia|cousin|brother|sister|friend|teacher|coach|captain|keeper|librarian|doctor|nurse|mr|mrs|ms|miss|dr)$/i

function properNouns(text: string): string[] {
  const out: string[] = []
  const sentences = text.split(/(?<=[.!?;:])\s+/)
  for (const s of sentences) {
    const words = s.split(/\s+/)
    words.forEach((w, i) => {
      const clean = w.replace(/^[^A-Za-z]+|[^A-Za-z']+$/g, '')
      if (!clean || i === 0) return
      if (/^[A-Z][a-z]{2,}$/.test(clean) && !STOP.has(clean) && !ROLE_WORDS.test(clean)) out.push(clean)
    })
  }
  return out
}

/**
 * Proper nouns that recur across plan beats (a named toy, a named boat)
 * EXCLUDING every token of every known character name ("Tio Rafa" → tio,
 * rafa) so a person can never become an object.
 */
function recurringProperNouns(plan: StoryPlan | null, excludeTokens: Set<string>, minPages = 3, max = 3): string[] {
  if (!plan) return []
  const counts = new Map<string, Set<number>>()
  for (const b of plan.pages) {
    for (const noun of new Set(properNouns(`${b.beat} ${b.continuity}`))) {
      if (excludeTokens.has(noun.toLowerCase())) continue
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
  /** Parent/family note (custom_notes); only explicit named objects are read from it. */
  customNotes?: string | null
  illustrationStyle: string
  styleHint: string
  plan: StoryPlan | null
  consistencyRules?: string | null
}

const INVENTED_TOPS = ['{c} t-shirt', '{c} jumper', '{c} striped top']
const INVENTED_BOTTOMS = ['blue trousers', 'dark shorts', 'corduroy trousers']
const INVENTED_FOOTWEAR = ['white trainers', 'brown boots', 'blue wellies']

/**
 * Outfit = the parent's garments verbatim + invented fillers ONLY for empty
 * slots. A dress/dungarees-type garment fills top and bottom; outerwear
 * counts as the top. Nothing explicit is ever replaced.
 */
export function buildOutfit(app: Appearance, fallbackOutfit: string, colour: string, seed: string, salt: string): VisualOutfit & { canonical: string } {
  const explicit = app.garments.map(g => g.phrase)
  if (explicit.length === 0) return { explicit: [], invented: [fallbackOutfit], canonical: fallbackOutfit }
  const slots = new Set(app.garments.map(g => g.slot))
  const invented: string[] = []
  const hasTop = slots.has('top') || slots.has('outerwear') || slots.has('full')
  const hasBottom = slots.has('bottom') || slots.has('full')
  if (!hasTop) invented.push(withArticle(pick(INVENTED_TOPS, seed, salt + '-top').replace('{c}', colour)))
  if (!hasBottom) invented.push(pick(INVENTED_BOTTOMS, seed, salt + '-bottom'))
  if (!slots.has('footwear')) invented.push(pick(INVENTED_FOOTWEAR, seed, salt + '-feet'))
  const canonical = [...explicit, ...invented].join(', ')
  return { explicit, invented, canonical }
}

function identityFor(app: Appearance, roleText: string): VisualIdentity {
  if (app.species) {
    const creature = /^(dragon|robot|unicorn|monster|alien|fairy|teddy bear|dinosaur)$/.test(app.species)
    return { kind: creature ? 'creature' : 'animal', species: app.species, markings: app.markings }
  }
  const r = roleText.toLowerCase()
  const m = r.match(/\b(dragon|robot|monster|alien|fairy|wizard|witch|giant|creature|elf|knight|pirate)\b/)
  if (m) return { kind: 'creature', species: m[1], markings: [] }
  return { kind: 'human', species: null, markings: [] }
}

function supportingVisual(name: string, rawRole: string, app: Appearance, colour: string, seed: string): { visual_description: string; canonical_outfit: string; identity: VisualIdentity; outfit: VisualOutfit } {
  // "little brother" → "the little brother"; "a friend" stays as written.
  const role = /^(a|an|the|his|her|their|[A-Z][a-z]+'s)\b/i.test(rawRole.trim()) || !rawRole.trim() ? rawRole.trim() : `the ${rawRole.trim()}`
  const r = role.toLowerCase()
  const identity = identityFor(app, r)
  const looks = appearanceSummary({ ...app, build: null })
  const propsText = app.props?.length ? `, carrying ${app.props.join(' and ')}` : ''
  const withLooks = (base: string) => `${looks.length ? `${base}, ${looks.join(', ')}` : base}${propsText}`

  if (identity.kind === 'animal' && identity.species) {
    const colourWords = identity.markings.filter(m => !/\s/.test(m))
    const detail = identity.markings.filter(m => /\s/.test(m))
    const head = withArticle([app.build ?? '', ...colourWords, identity.species].filter(Boolean).join(' '))
    const base = `${head} (${withArticle(identity.species.toUpperCase())}, never any other kind of animal)${detail.length ? ` with ${detail.join(' and ')}` : ''}`
    // Only pets that plausibly wear one get an invented collar; birds, fish and wild animals get nothing invented.
    const wearsCollar = /^(cat|dog|rabbit|horse|hamster|guinea pig|goat|sheep|pig|cow)$/.test(identity.species)
    const outfit = app.garments.length || wearsCollar ? buildOutfit(app, withArticle(`${colour} collar`), colour, seed, name) : { explicit: [], invented: [], canonical: '' }
    return { visual_description: withLooks(base), canonical_outfit: outfit.canonical, identity, outfit: { explicit: outfit.explicit, invented: outfit.invented } }
  }
  if (identity.kind === 'creature' && identity.species) {
    const outfit = buildOutfit(app, `with ${colour} as its signature colour`, colour, seed, name)
    return { visual_description: withLooks(`a friendly, child-safe ${identity.species} (always a ${identity.species.toUpperCase()})`), canonical_outfit: outfit.canonical, identity, outfit: { explicit: outfit.explicit, invented: outfit.invented } }
  }
  if (/\b(brother|sister|cousin|friend|classmate|neighbou?r|toddler|baby|twin)\b/.test(r)) {
    const younger = /\b(little|younger|baby|toddler)\b/.test(r)
    const outfit = buildOutfit(app, pick([withArticle(`${colour} t-shirt with shorts`), withArticle(`${colour} striped top with full-length dungarees`), withArticle(`${colour} hoodie with trousers`)], seed, name), colour, seed, name)
    return { visual_description: withLooks(`${younger ? 'a smaller, younger child' : 'a child about the same age'} who is ${role}`), canonical_outfit: outfit.canonical, identity, outfit: { explicit: outfit.explicit, invented: outfit.invented } }
  }
  const adultRole = /\b(mum|mom|mother|dad|father|grandma|grandmother|nana|granny|grandpa|grandfather|abuela|abuelo|teacher|aunt|auntie|uncle|tio|tia|captain|keeper|guard|librarian|coach|doctor|nurse|babysitter)\b/.test(r)
  const outfit = buildOutfit(app, pick(adultRole ? [withArticle(`${colour} cardigan`), withArticle(`${colour} jacket`), withArticle(`${colour} apron over a plain shirt`)] : [withArticle(`${colour} jacket`)], seed, name), colour, seed, name)
  const adultHead = app.build ? withArticle(`${app.build} adult`) : 'an adult'
  return { visual_description: withLooks(adultRole ? `${adultHead} who is ${role}` : (role || 'a supporting character')), canonical_outfit: outfit.canonical, identity, outfit: { explicit: outfit.explicit, invented: outfit.invented } }
}

/** Parse the parent's free-text supporting characters into name/role pairs (kept for callers; the builder uses the richer entries). */
export function parseSupportingText(text: string | null | undefined): { name: string; role: string }[] {
  return parseSupportingEntries(text).map(e => ({ name: e.name, role: e.role || e.descriptor || 'a companion' }))
}

export function buildVisualBible(input: VisualBibleInput): VisualBible {
  // The seed is a hash of the request id + name: deterministic for the
  // story, but the raw request id itself is not stored in the bible.
  const seed = stableHash(`${input.requestId}|${input.childName}`).toString(16)
  const name = input.childName.trim() || 'the hero'
  const app = parseAppearance(input.childDescription, { subject: 'protagonist' })
  const cues = appearanceSummary(app)
  const heroColour = app.favourite_colour && (COLOURS as readonly string[]).includes(app.favourite_colour) ? app.favourite_colour : pick(COLOURS, seed, 'hero-colour')

  const settingText = `${input.plan?.setting ?? ''} ${input.plan?.premise ?? ''}`
  const kind = settingKind(settingText)
  const fallbackOutfit = pick(OUTFITS[kind], seed, 'hero-outfit').replace('{c}', heroColour)
  const heroOutfit = buildOutfit(app, fallbackOutfit, heroColour, seed, 'hero')
  const heroIdentity = identityFor(app, '')

  // Supporting characters: the parent's entries are authoritative for
  // appearance; the plan contributes roles and any character the parent
  // did not name. Records that share a name token are the same person.
  const parentEntries = parseSupportingEntries(input.supportingCharactersText)
  const supporting: VisualSupporting[] = []
  const take = (n: string, role: string, app2: Appearance) => {
    if (!n || sameCharacter(n, name) || supporting.some(s => sameCharacter(s.name, n))) return
    const colour = COLOURS.filter(x => x !== heroColour)[stableHash(seed + '|sc|' + n) % (COLOURS.length - 1)]
    const v = supportingVisual(n, role, app2, colour, seed)
    supporting.push({ name: n, role, visual_description: v.visual_description, canonical_outfit: v.canonical_outfit, identity: v.identity, appearance: app2, outfit: v.outfit })
  }
  for (const e of parentEntries) {
    const planMatch = input.plan?.supporting_characters.find(c => sameCharacter(c.name, e.name))
    // parent role words win; the plan's richer role text is used only when the parent gave none
    take(e.name, e.role || planMatch?.role || e.descriptor || 'a companion', e.appearance)
    if (supporting.length >= 4) break
  }
  for (const c of input.plan?.supporting_characters ?? []) {
    if (supporting.length >= 4) break
    take(c.name.trim(), c.role, parseAppearance(c.role, { subject: 'supporting' }))
  }

  // Recurring objects: the parent's named objects first, then proper nouns
  // that recur in the plan — never a character name or any token of one.
  const nameTokens = new Set<string>()
  for (const n of [name, ...supporting.map(s => s.name)]) for (const t of n.toLowerCase().split(/\s+/)) if (t.length >= 2) nameTokens.add(t)
  const explicitObjects = extractExplicitObjects(`${input.customNotes ?? ''} ${input.childDescription ?? ''}`, [name, ...supporting.map(s => s.name)])
  const planObjects = recurringProperNouns(input.plan, nameTokens).filter(o => !explicitObjects.some(e => e.toLowerCase().includes(o.toLowerCase())))
  const recurring = [...explicitObjects, ...planObjects].slice(0, 3)
  // a hero prop that is also the story's recurring object stays global only
  app.props = (app.props ?? []).filter(pr => !recurring.some(r => r.toLowerCase().includes(pr.toLowerCase()) || pr.toLowerCase().includes(r.toLowerCase())))
  const art = ART_BY_STYLE[input.illustrationStyle] ?? ART_BY_STYLE.storybook

  return {
    version: VISUAL_BIBLE_VERSION,
    seed,
    protagonist: {
      name,
      approximate_age: Number.isFinite(Number(input.childAge)) && Number(input.childAge) < 18 ? Number(input.childAge) : null,
      parent_visual_cues: cues,
      canonical_outfit: heroOutfit.canonical,
      recurring_objects: recurring,
      identity: heroIdentity,
      appearance: app,
      outfit: { explicit: heroOutfit.explicit, invented: heroOutfit.invented },
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

/** Accepts v1 (Phase 1E) and v2 (Phase 1H) bibles; anchors read both. Persisted bibles are never rewritten. */
export function validateVisualBible(raw: unknown): BibleValidation {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['visual bible is not an object'] }
  const b = raw as Record<string, unknown>
  if (!SUPPORTED_BIBLE_VERSIONS.includes(b.version as number)) errors.push('visual bible version mismatch')
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

/** Matches the character by any name token of 3+ letters ("Grandma Joyce" ← "Grandma waves"), possessives included. */
const nameRe = (name: string) => {
  const tokens = name.split(/\s+/).filter(t => t.length >= 3).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const alt = tokens.length ? tokens.join('|') : name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b(?:${alt})(?:'s)?\\b`, 'i')
}

/**
 * Canonical protagonist anchor: identity facts first (age, species, the
 * parent's cues), then the canonical outfit, then recurring objects, then
 * the continuity instruction. Byte-identical on every page and the cover.
 */
export function protagonistAnchor(b: VisualBible): string {
  const p = b.protagonist
  const parts: string[] = []
  const species = p.identity?.species
  const build = p.appearance?.build ?? null
  const who = species
    ? `${withArticle([build ?? '', ...(p.identity?.markings ?? []).filter(m => !/\s/.test(m)), species].filter(Boolean).join(' '))} (${withArticle(species.toUpperCase())}, never any other kind of animal)${p.approximate_age ? `, ${p.approximate_age} years old` : ''}`
    : (p.approximate_age ? withArticle(`${build ? `${build} ` : ''}${p.approximate_age}-year-old child`) : (build ? withArticle(`${build} main character`) : 'the main character'))
  parts.push(`${p.name} is ${who}`)
  const cues = p.parent_visual_cues.filter(c => c !== build)
  if (cues.length) parts.push(`with ${cues.join(', ')}`)
  parts.push(`wearing ${p.canonical_outfit}`)
  if (p.appearance?.props?.length) parts.push(`carrying ${p.appearance.props.join(' and ')}`)
  if (p.recurring_objects.length) parts.push(`(always with: ${p.recurring_objects.join(', ')})`)
  return `${parts.join(' ')}; keep ${p.name}'s face, hair, build and outfit identical to every other page of this book`
}

export function supportingAnchor(s: VisualSupporting): string {
  const outfit = s.canonical_outfit?.trim() ? `, wearing ${s.canonical_outfit.trim()}` : ''
  return `${s.name} is ${s.visual_description}${outfit}; keep ${s.name} identical across pages`
}

/** No logos, trademarks or brand marks anywhere — survives truncation like the safety suffix. */
export const NO_BRAND_RULE =
  'No logos, trademarks, brand marks, branded clothing or readable brand names anywhere in the image; all clothing, shoes, bags and objects are generic and unbranded.'

/** The model may not add its own persistent cast or props. */
export const NO_INVENTION_RULE =
  'Do not add pets, companions, mascots, toys or signature objects that are not named in the character anchors or this scene; incidental background people and scenery are fine.'

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
    anchors.length ? `Characters in this scene (identity facts are fixed for the whole book): ${anchors.map(a => clipT(a, limits.anchor)).join('. ')}.` : '',
    `Scene: ${clipT(desc, limits.desc)}`,
    continuity ? `Page continuity (temporary state for this page only — everything else stays as in the character anchors): ${clipT(continuity, limits.cont)}` : '',
    world ? `${clipT(world, limits.world)}. Palette: ${b.art_direction.palette_guidance}. Lighting: ${b.art_direction.lighting_guidance}.` : `Palette: ${b.art_direction.palette_guidance}. Lighting: ${b.art_direction.lighting_guidance}.`,
    b.art_direction.consistency_rules,
    NO_INVENTION_RULE,
    NO_BRAND_RULE,
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
    // Last resort: hard cut, then re-append the rules that must never be lost.
    const tail = ` ${NO_BRAND_RULE} ${args.safetySuffix}`
    prompt = prompt.slice(0, max - tail.length).trimEnd() + tail
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

/** New covers are JPEG (see imageProvider.ts); legacy covers keep their stored cover.png path. */
export const COVER_FILENAME = 'cover.jpg'
export function coverStoragePath(requestId: string, ext: 'jpg' | 'png' = 'jpg'): string {
  return `${requestId}/cover.${ext}`
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

export const MAX_COVER_COMPANIONS = 2

/**
 * Supporting characters anchored on the cover, max two: those present in
 * ≥ 40% of beats, plus any character the cover text itself names (premise,
 * setting) — a named character must never reach the image model without
 * its canonical anchor. Ranked by beat frequency when more than two qualify.
 */
export function relevantSupportingForCover(bible: VisualBible, plan: StoryPlan | null, coverText = ''): VisualSupporting[] {
  if (!plan || plan.pages.length === 0) return []
  const n = plan.pages.length
  return bible.supporting_characters
    .map(s => ({ s, hits: plan.pages.filter(p => nameRe(s.name).test(`${p.beat} ${p.continuity}`)).length, named: coverText ? nameRe(s.name).test(coverText) : false }))
    .filter(x => x.hits / n >= 0.4 || x.named)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, MAX_COVER_COMPANIONS)
    .map(x => x.s)
}

/**
 * Remove every mention of supporting characters that are NOT anchored from
 * cover text, replacing the name with a neutral role so the sentence still
 * reads but no un-anchored figure is requested.
 */
export function scrubUnanchoredNames(text: string, unanchored: VisualSupporting[]): string {
  let out = text
  for (const s of unanchored) {
    const role = s.role && /^[a-z\s'-]+$/i.test(s.role) && s.role.split(/\s+/).length <= 3 ? `her ${s.role.replace(/^(?:her|his|their|the)\s+/i, '')}` : 'a companion'
    out = out.replace(new RegExp(`\\b${s.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s)?\\b`, 'gi'), m => (/'s$/i.test(m) ? `${role}'s` : role))
  }
  return out
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
  const rawPremise = (args.plan?.premise ?? '').trim()
  const rawSetting = (args.plan?.setting ?? b.setting.core_environment ?? '').trim()
  const companions = relevantSupportingForCover(b, args.plan, `${rawPremise} ${rawSetting}`)
  const unanchored = b.supporting_characters.filter(s => !companions.includes(s))
  const anchors = [protagonistAnchor(b), ...companions.map(supportingAnchor)]
  const premise = scrubUnanchoredNames(rawPremise, unanchored)
  const setting = scrubUnanchoredNames(rawSetting, unanchored)
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
    NO_INVENTION_RULE,
    args.bandImageHint?.trim() ? `${args.bandImageHint.trim()}.` : '',
    COVER_NO_TEXT_RULE,
    NO_BRAND_RULE,
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
    const tail = ` ${COVER_NO_TEXT_RULE} ${NO_BRAND_RULE} ${args.safetySuffix}`
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
