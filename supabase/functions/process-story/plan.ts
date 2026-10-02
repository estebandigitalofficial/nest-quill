// Story plan (Stage 1) and final book (Stage 2) contracts, validation,
// bounded repair and the plan → prompt rendering.
//
// Pure module: no Deno / Supabase / network. Imported by the Edge Function
// and exercised by Node tests (plan.test.ts).
//
// The story plan is an INTERNAL generation artifact. It is persisted on
// story_requests.story_plan for checkpoint/recovery and debugging, and it is
// never returned by the public story API (which reads generated_stories and
// story_scenes only) — see toSceneRows() for the only transformation that
// feeds the reader.

// ── Stage 1: story plan ───────────────────────────────────────────────────────

export const PLAN_PHASES = ['setup', 'inciting', 'development', 'complication', 'climax', 'resolution'] as const
export type PlanPhase = typeof PLAN_PHASES[number]

export interface PlanBeat {
  page: number
  phase: PlanPhase
  /** What happens on this page. */
  beat: string
  /** Why this page exists in the story. */
  purpose: string
  /** Character / emotional development on this page (may be short). */
  development: string
  /** What the next page must remember (location, objects, who is present, mood). */
  continuity: string
}

export interface StoryPlan {
  title: string
  premise: string
  protagonist: { name: string; characterization: string; want: string }
  supporting_characters: { name: string; role: string }[]
  setting: string
  central_conflict: string
  goal: string
  emotional_arc: string
  beginning_state: string
  escalation: string
  climax: string
  resolution: string
  ending_state: string
  /** Empty string when the story carries no explicit lesson. */
  lesson: string
  pages: PlanBeat[]
}

/** Maximum model calls per stage: one attempt plus one bounded repair. */
export const MAX_STAGE_ATTEMPTS = 2

const MIN_BEAT_CHARS = 12

/**
 * Titles that are interchangeable with any other AI picture book. Treated as
 * a validation error so the bounded repair asks for a specific one.
 */
export const GENERIC_TITLE_RE =
  /^(?:the|a|an)?\s*(?:(?:magical|magic|great|big|brave|little|wonderful|amazing|incredible|epic|grand|special|enchanted|greatest|biggest)\s*){0,2}(?:adventure|journey|quest|hero|tale|story)s?(?:\s+of\s+(?:friendship|courage|kindness|bravery|discovery|a lifetime))?\s*!?$/i

export function isGenericTitle(title: string): boolean {
  const t = title.trim()
  if (!t) return true
  return GENERIC_TITLE_RE.test(t)
}

/** Parse model output as JSON, tolerating ```json fences and surrounding prose. */
export function safeParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const raw = String(text ?? '').trim()
  const candidates: string[] = [raw]
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) candidates.unshift(fenced[1].trim())
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  if (first >= 0 && last > first) candidates.push(raw.slice(first, last + 1))
  let lastError = 'empty output'
  for (const c of candidates) {
    if (!c) continue
    try {
      return { ok: true, value: JSON.parse(c) }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  return { ok: false, error: `not valid JSON (${lastError})` }
}

const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : typeof v === 'number' ? String(v) : '')

function requireText(errors: string[], obj: Record<string, unknown>, key: string, label = key, min = 3): string {
  const s = str(obj[key])
  if (s.length < min) errors.push(`${label} is missing or empty`)
  return s
}

export type PlanValidation = { ok: true; plan: StoryPlan } | { ok: false; errors: string[] }

/**
 * Structural validation of a Stage 1 plan. Normalises whitespace, sorts
 * beats by page, fills harmless defaults (phase, supporting characters,
 * lesson) and rejects anything the book stage cannot safely build on.
 */
export function validateStoryPlan(raw: unknown, pageCount: number): PlanValidation {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['plan is not a JSON object'] }
  }
  const o = raw as Record<string, unknown>

  const title = str(o.title)
  if (!title) errors.push('title is empty')
  else if (isGenericTitle(title)) errors.push(`title "${title}" is generic — it must come from a distinctive object, problem, place, action or idea in this story`)

  const premise = requireText(errors, o, 'premise')
  const setting = requireText(errors, o, 'setting')
  const central_conflict = requireText(errors, o, 'central_conflict', 'central_conflict')
  const goal = requireText(errors, o, 'goal')
  const emotional_arc = requireText(errors, o, 'emotional_arc', 'emotional_arc')
  const beginning_state = requireText(errors, o, 'beginning_state', 'beginning_state')
  const escalation = requireText(errors, o, 'escalation')
  const climax = requireText(errors, o, 'climax')
  const resolution = requireText(errors, o, 'resolution')
  const ending_state = requireText(errors, o, 'ending_state', 'ending_state')
  const lesson = str(o.lesson)

  const p = (o.protagonist && typeof o.protagonist === 'object' ? o.protagonist : {}) as Record<string, unknown>
  const protagonist = {
    name: str(p.name),
    characterization: str(p.characterization),
    want: str(p.want),
  }
  if (!protagonist.name) errors.push('protagonist.name is missing')
  if (protagonist.characterization.length < 3) errors.push('protagonist.characterization is missing or empty')
  if (protagonist.want.length < 3) errors.push('protagonist.want is missing or empty')

  const supporting_characters = Array.isArray(o.supporting_characters)
    ? (o.supporting_characters as unknown[])
        .map(c => (c && typeof c === 'object' ? c : {}) as Record<string, unknown>)
        .map(c => ({ name: str(c.name), role: str(c.role) }))
        .filter(c => c.name)
    : []

  const pagesRaw = Array.isArray(o.pages) ? (o.pages as unknown[]) : null
  const pages: PlanBeat[] = []
  if (!pagesRaw) {
    errors.push('pages is missing')
  } else {
    if (pagesRaw.length !== pageCount) {
      errors.push(`pages has ${pagesRaw.length} beats but exactly ${pageCount} are required`)
    }
    pagesRaw.forEach((b, i) => {
      const beat = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>
      const pageNum = Number(beat.page)
      const phaseRaw = str(beat.phase).toLowerCase()
      const phase = (PLAN_PHASES as readonly string[]).includes(phaseRaw) ? (phaseRaw as PlanPhase) : 'development'
      const text = str(beat.beat)
      const purpose = str(beat.purpose)
      if (text.length < MIN_BEAT_CHARS) errors.push(`page ${Number.isFinite(pageNum) ? pageNum : i + 1}: beat is empty or too thin`)
      if (!purpose) errors.push(`page ${Number.isFinite(pageNum) ? pageNum : i + 1}: purpose is missing`)
      pages.push({
        page: Number.isFinite(pageNum) ? pageNum : i + 1,
        phase,
        beat: text,
        purpose,
        development: str(beat.development),
        continuity: str(beat.continuity),
      })
    })
    pages.sort((a, b) => a.page - b.page)
    if (pagesRaw.length === pageCount) {
      const expected = pages.every((pg, i) => pg.page === i + 1)
      if (!expected) {
        // Count is right but numbering is off — renumber in order (bounded transformation).
        pages.forEach((pg, i) => { pg.page = i + 1 })
      }
      const hasClimax = pages.some(pg => pg.phase === 'climax')
      const hasResolution = pages.some(pg => pg.phase === 'resolution')
      if (!hasClimax) errors.push('no page beat is marked as the climax')
      if (!hasResolution) errors.push('no page beat is marked as resolution')
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    plan: {
      title, premise, protagonist, supporting_characters, setting, central_conflict, goal,
      emotional_arc, beginning_state, escalation, climax, resolution, ending_state, lesson, pages,
    },
  }
}

/** Compact, labelled rendering of the plan for the Stage 2 prompt. */
export function renderPlanForPrompt(plan: StoryPlan): string {
  const lines: string[] = []
  lines.push(`Title: ${plan.title}`)
  lines.push(`Premise: ${plan.premise}`)
  lines.push(`Protagonist: ${plan.protagonist.name} — ${plan.protagonist.characterization}. Wants: ${plan.protagonist.want}`)
  if (plan.supporting_characters.length > 0) {
    lines.push(`Supporting characters: ${plan.supporting_characters.map(c => `${c.name} (${c.role})`).join('; ')}`)
  }
  lines.push(`Setting: ${plan.setting}`)
  lines.push(`Central conflict: ${plan.central_conflict}`)
  lines.push(`Goal: ${plan.goal}`)
  lines.push(`Emotional arc: ${plan.emotional_arc}`)
  lines.push(`Beginning state: ${plan.beginning_state}`)
  lines.push(`Escalation: ${plan.escalation}`)
  lines.push(`Climax: ${plan.climax}`)
  lines.push(`Resolution: ${plan.resolution}`)
  lines.push(`Ending state: ${plan.ending_state}`)
  if (plan.lesson) lines.push(`Lesson (show, never announce): ${plan.lesson}`)
  lines.push('')
  lines.push('Page beats (one page of prose per beat, in this order):')
  for (const b of plan.pages) {
    const extra = [b.development ? `development: ${b.development}` : '', b.continuity ? `carry forward: ${b.continuity}` : ''].filter(Boolean).join(' | ')
    lines.push(`${b.page}. [${b.phase}] ${b.beat} — purpose: ${b.purpose}${extra ? ` | ${extra}` : ''}`)
  }
  return lines.join('\n')
}

// ── Stage 2: final book ───────────────────────────────────────────────────────

export interface BookPage {
  page: number
  text: string
  image_description: string
}

export interface BookOutput {
  title: string
  subtitle: string
  author_line: string
  dedication: string
  synopsis: string
  pages: BookPage[]
}

export type BookValidation = { ok: true; book: BookOutput } | { ok: false; errors: string[] }

/**
 * Structural validation of the Stage 2 book against the existing downstream
 * contract (title + pages[{page, text, image_description}]).
 */
export function validateBook(raw: unknown, pageCount: number): BookValidation {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['book is not a JSON object'] }
  }
  const o = raw as Record<string, unknown>
  const title = str(o.title)
  if (!title) errors.push('title is empty')

  const pagesRaw = Array.isArray(o.pages) ? (o.pages as unknown[]) : null
  const pages: BookPage[] = []
  if (!pagesRaw || pagesRaw.length === 0) {
    errors.push('pages is missing or empty')
  } else {
    if (pagesRaw.length !== pageCount) {
      errors.push(`pages has ${pagesRaw.length} entries but exactly ${pageCount} are required`)
    }
    pagesRaw.forEach((pg, i) => {
      const page = (pg && typeof pg === 'object' ? pg : {}) as Record<string, unknown>
      const n = Number(page.page)
      const text = typeof page.text === 'string' ? page.text.trim() : ''
      const image = str(page.image_description)
      if (!text) errors.push(`page ${Number.isFinite(n) ? n : i + 1}: text is empty`)
      if (!image) errors.push(`page ${Number.isFinite(n) ? n : i + 1}: image_description is missing`)
      pages.push({ page: Number.isFinite(n) ? n : i + 1, text, image_description: image })
    })
    pages.sort((a, b) => a.page - b.page)
    if (pagesRaw.length === pageCount && !pages.every((pg, i) => pg.page === i + 1)) {
      pages.forEach((pg, i) => { pg.page = i + 1 })
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    book: {
      title,
      subtitle: str(o.subtitle),
      author_line: str(o.author_line),
      dedication: typeof o.dedication === 'string' ? o.dedication.trim() : '',
      synopsis: str(o.synopsis),
      pages,
    },
  }
}

// ── Bounded repair ────────────────────────────────────────────────────────────

export interface ChatMessage { role: string; content: string }

const MAX_ECHO_CHARS = 6000

/**
 * Build the follow-up conversation for ONE repair attempt: the original
 * messages, the model's previous (bad) answer, and a precise list of what
 * to fix. The model must return the complete corrected JSON object.
 */
export function buildRepairMessages(
  messages: ChatMessage[],
  previousOutput: string,
  errors: string[],
  what: 'story plan' | 'book',
): ChatMessage[] {
  const echoed = previousOutput.length > MAX_ECHO_CHARS
    ? previousOutput.slice(0, MAX_ECHO_CHARS) + '\n…(truncated)'
    : previousOutput
  return [
    ...messages,
    { role: 'assistant', content: echoed || '{}' },
    {
      role: 'user',
      content:
        `Your ${what} JSON had these problems:\n` +
        errors.slice(0, 12).map(e => `- ${e}`).join('\n') +
        `\n\nReturn the complete corrected ${what} as a single JSON object with the same structure. ` +
        'Fix only what is listed, keep everything else as it was, and do not add commentary.' +
        (what === 'book'
          ? ' The STORY PLAN stays authoritative: keep every planned event, character fact and the page order exactly; revise only the prose and image descriptions named above.'
          : ''),
    },
  ]
}

// ── Downstream mapping ────────────────────────────────────────────────────────

/**
 * The only path from generation output to what the reader sees. Nothing
 * from the story plan is included: the plan is internal metadata.
 */
export function toSceneRows(book: BookOutput, ids: { storyId: string; requestId: string }) {
  return book.pages.map(p => ({
    story_id: ids.storyId,
    request_id: ids.requestId,
    page_number: p.page,
    page_text: p.text,
    image_prompt: p.image_description,
    image_status: 'pending' as const,
  }))
}

// ── Telemetry shape ───────────────────────────────────────────────────────────

export interface StageUsage {
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  ms: number
  attempts: number
  model: string
}

export function sumUsage(stages: StageUsage[]): { prompt_tokens: number | null; completion_tokens: number | null } {
  const sum = (k: 'prompt_tokens' | 'completion_tokens') => {
    const vals = stages.map(s => s[k]).filter((v): v is number => typeof v === 'number')
    return vals.length === stages.length && vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null
  }
  return { prompt_tokens: sum('prompt_tokens'), completion_tokens: sum('completion_tokens') }
}
