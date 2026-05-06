// Post-completion learning activities.
//
// After a learning story finishes, the reader can engage with the material in
// more than one way. This module handles two responsibilities:
//
// 1. Selection — given a grade, subject, and the story body, return 2-4
//    activity types appropriate for the learner's age band. Results are
//    deterministic for the same input so QA is reproducible while still
//    feeling varied across grades.
//
// 2. Prompt generation — strict-JSON OpenAI prompts for the four new activity
//    types. Quiz already exists in materialActivity.ts and is reused as-is;
//    flashcards is also covered there. The four types added here are:
//    trivia, matching, fill_in_the_blank, puzzle.

export type ActivityType =
  | 'quiz'
  | 'trivia'
  | 'flashcards'
  | 'matching'
  | 'fill_in_the_blank'
  | 'puzzle'

export interface ActivitySelectionInput {
  grade?: number | null
  subject?: string | null
  content: string
}

const GRADE_BANDS: { min: number; max: number; types: ActivityType[] }[] = [
  { min: 1, max: 2,  types: ['flashcards', 'matching'] },
  { min: 3, max: 5,  types: ['quiz', 'fill_in_the_blank', 'matching'] },
  { min: 6, max: 8,  types: ['quiz', 'trivia', 'puzzle'] },
  { min: 9, max: 12, types: ['trivia', 'quiz', 'puzzle', 'fill_in_the_blank'] },
]

function bandFor(grade?: number | null): ActivityType[] {
  const g = typeof grade === 'number' && Number.isFinite(grade) ? grade : 4
  const band = GRADE_BANDS.find(b => g >= b.min && g <= b.max)
  return band ? band.types : GRADE_BANDS[1].types
}

/**
 * Pick 2-4 activities for a completed learning story.
 *
 * Deterministic — same (grade, content) returns the same ordering — so QA can
 * verify selections per grade. The first item is always `quiz` when the band
 * includes it, which keeps continuity with the existing quiz CTA.
 */
export function chooseActivities(input: ActivitySelectionInput): ActivityType[] {
  const types = bandFor(input.grade)
  // Stable trim to 2-4 based on content size — short stories get 2 activities,
  // long ones up to 4. Keeps the picker UI from feeling padded for tiny inputs.
  const wordCount = input.content.trim().split(/\s+/).filter(Boolean).length
  const desired = wordCount < 200 ? 2 : wordCount < 500 ? 3 : Math.min(4, types.length)
  const ordered = [...types]
  // Quiz first when present
  ordered.sort((a, b) => (a === 'quiz' ? -1 : b === 'quiz' ? 1 : 0))
  return ordered.slice(0, desired)
}

// ── Per-type schema descriptions (used in prompts) ───────────────────────────

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  quiz: 'Quiz',
  trivia: 'Trivia',
  flashcards: 'Flashcards',
  matching: 'Matching',
  fill_in_the_blank: 'Fill in the Blank',
  puzzle: 'Puzzle',
}

// JSON shapes the runners consume. Kept simple on purpose.
export interface TriviaPayload {
  type: 'trivia'
  questions: { question: string; choices: string[]; answer: string; explanation?: string }[]
}
export interface MatchingPayload {
  type: 'matching'
  pairs: { left: string; right: string }[]
}
export interface FillInBlankPayload {
  type: 'fill_in_the_blank'
  items: { sentence: string; answer: string; choices?: string[] }[]
}
export interface PuzzlePayload {
  type: 'puzzle'
  prompt: string
  clues: string[]
  answer: string
}

export type ActivityPayload =
  | TriviaPayload
  | MatchingPayload
  | FillInBlankPayload
  | PuzzlePayload

// ── Prompt builders ───────────────────────────────────────────────────────────

function gradeRules(grade?: number | null): string {
  const g = typeof grade === 'number' ? grade : 4
  if (g <= 2)  return 'Use very simple words (1-2 syllables when possible). Keep sentences short. Limit to 4 items.'
  if (g <= 5)  return 'Use grade-appropriate vocabulary. Keep sentences clear and concrete. 5-6 items.'
  if (g <= 8)  return 'Use richer vocabulary and ask for some inference. 5-7 items.'
  return 'Use sophisticated vocabulary and reasoning. Encourage deeper comprehension and synthesis. 5-8 items.'
}

const NEUTRALITY = 'Stay neutral and educational. No political opinions, no adult themes, no scary or violent content.'

interface PromptInput {
  type: ActivityType
  content: string
  grade?: number | null
  subject?: string | null
}

export function buildActivityPrompt({ type, content, grade, subject }: PromptInput): { system: string; user: string } | null {
  const gradeLabel = typeof grade === 'number' ? `grade ${grade}` : 'elementary school'
  const subjectLine = subject ? `Subject: ${subject}.\n` : ''
  const userBase = `${subjectLine}Story:\n\n${content.trim().slice(0, 6000)}`
  const rules = gradeRules(grade)

  if (type === 'trivia') {
    return {
      system: `You are an educational trivia writer for ${gradeLabel} students. Create trivia questions based ONLY on the story below. ${rules} ${NEUTRALITY}

Output strict JSON:
{
  "type": "trivia",
  "questions": [
    {
      "question": "string",
      "choices": ["A", "B", "C", "D"],
      "answer": "exact text of the correct choice",
      "explanation": "1 sentence why"
    }
  ]
}
Rules:
- Each "answer" string MUST exactly match one entry in "choices".
- 3-4 choices per question.`,
      user: `${userBase}\n\nWrite ${gradeLabel}-appropriate trivia questions about this story.`,
    }
  }

  if (type === 'matching') {
    return {
      system: `You are an educator creating a matching activity for ${gradeLabel} students. Build pairs that come ONLY from the story. ${rules} ${NEUTRALITY}

Output strict JSON:
{
  "type": "matching",
  "pairs": [
    {"left": "term or character", "right": "definition or description"}
  ]
}
Rules:
- 4-6 pairs.
- "left" should be short (1-3 words). "right" should be 1 short sentence.
- Pairs must be unambiguous — exactly one right matches each left.`,
      user: `${userBase}\n\nCreate matching pairs for ${gradeLabel} students.`,
    }
  }

  if (type === 'fill_in_the_blank') {
    return {
      system: `You write fill-in-the-blank exercises for ${gradeLabel} students based ONLY on the story. ${rules} ${NEUTRALITY}

Output strict JSON:
{
  "type": "fill_in_the_blank",
  "items": [
    {
      "sentence": "The hero hid in the ___ when the storm came.",
      "answer": "cave",
      "choices": ["cave", "tree", "river", "barn"]
    }
  ]
}
Rules:
- Use exactly three underscores "___" as the blank.
- "answer" MUST appear in "choices". 3-4 choices.
- Sentences should be drawn from or naturally derivable from the story.`,
      user: `${userBase}\n\nCreate fill-in-the-blank items for ${gradeLabel} students.`,
    }
  }

  if (type === 'puzzle') {
    return {
      system: `You are designing a guess-the-answer puzzle for ${gradeLabel} students based on the story. ${NEUTRALITY}

Output strict JSON:
{
  "type": "puzzle",
  "prompt": "Who or what am I?",
  "clues": ["clue 1", "clue 2", "clue 3"],
  "answer": "single word or short phrase"
}
Rules:
- 3-5 clues, getting progressively more specific.
- Answer should be a character, object, place, or concept directly from the story.
- Keep it solvable with the clues alone — no guessing.`,
      user: `${userBase}\n\nDesign one puzzle for ${gradeLabel} students based on this story.`,
    }
  }

  return null
}

// ── Lightweight validators (defensive against malformed model output) ────────

export function validateActivityPayload(type: ActivityType, raw: unknown): ActivityPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  if (type === 'trivia') {
    const qs = obj.questions
    if (!Array.isArray(qs) || qs.length === 0) return null
    const ok = qs.every(q => {
      const r = q as Record<string, unknown>
      return typeof r.question === 'string'
        && Array.isArray(r.choices) && r.choices.every(c => typeof c === 'string')
        && typeof r.answer === 'string'
        && r.choices.includes(r.answer as string)
    })
    return ok ? { type: 'trivia', questions: qs as TriviaPayload['questions'] } : null
  }

  if (type === 'matching') {
    const pairs = obj.pairs
    if (!Array.isArray(pairs) || pairs.length < 3) return null
    const ok = pairs.every(p => {
      const r = p as Record<string, unknown>
      return typeof r.left === 'string' && typeof r.right === 'string'
    })
    return ok ? { type: 'matching', pairs: pairs as MatchingPayload['pairs'] } : null
  }

  if (type === 'fill_in_the_blank') {
    const items = obj.items
    if (!Array.isArray(items) || items.length === 0) return null
    const ok = items.every(item => {
      const r = item as Record<string, unknown>
      if (typeof r.sentence !== 'string' || typeof r.answer !== 'string') return false
      if (r.choices !== undefined) {
        if (!Array.isArray(r.choices)) return false
        if (!r.choices.every(c => typeof c === 'string')) return false
        if (!r.choices.includes(r.answer as string)) return false
      }
      return true
    })
    return ok ? { type: 'fill_in_the_blank', items: items as FillInBlankPayload['items'] } : null
  }

  if (type === 'puzzle') {
    const clues = obj.clues
    if (typeof obj.prompt !== 'string' || typeof obj.answer !== 'string') return null
    if (!Array.isArray(clues) || clues.length === 0) return null
    if (!clues.every(c => typeof c === 'string')) return null
    return { type: 'puzzle', prompt: obj.prompt, clues: clues as string[], answer: obj.answer }
  }

  return null
}
