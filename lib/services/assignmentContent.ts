// Server-side content generator used when an educator creates an assignment.
// Runs the same OpenAI prompts the standalone learning tools use, but returns
// the result so the API can persist it on assignments.content. Students never
// regenerate; they only render and answer what the educator stored.

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPrompts, type ActivityMode } from '@/lib/services/materialActivity'
import { getActiveGuardrails } from '@/lib/utils/learningGuardrails'

export type AssignmentType =
  | 'quiz'
  | 'flashcards'
  | 'explain'
  | 'study-guide'
  | 'reading'

export const ASSIGNMENT_TYPES: AssignmentType[] = [
  'quiz', 'flashcards', 'explain', 'study-guide', 'reading',
]

export type ContentSource = 'topic' | 'material'

export interface GenerateInput {
  type: AssignmentType
  source: ContentSource
  topic?: string
  material?: string
  grade?: number
}

interface QuizQ {
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

interface QuizContent {
  kind: 'quiz'
  title: string
  sessionId: string
  questions: { question: string; options: string[] }[]
}

interface FlashcardContent {
  kind: 'flashcards'
  title: string
  cards: { front: string; back: string }[]
}

interface ExplainContent {
  kind: 'explain'
  title: string
  sections: { heading: string; content: string }[]
  summary: string
}

interface StudyGuideContent {
  kind: 'study-guide'
  title: string
  overview: string
  key_terms: { term: string; definition: string }[]
  main_concepts: { heading: string; content: string }[]
  remember: string[]
  practice_questions: { question: string; answer: string }[]
}

interface ReadingContent {
  kind: 'reading'
  title: string
  passage: string
  sessionId: string
  questions: { question: string; options: string[] }[]
}

export type AssignmentContent =
  | QuizContent
  | FlashcardContent
  | ExplainContent
  | StudyGuideContent
  | ReadingContent

export interface GenerateResult {
  content: AssignmentContent
  config: Record<string, unknown>
}

export class AssignmentGenerationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

function shuffleQuiz(questions: QuizQ[]): QuizQ[] {
  return questions.map(q => {
    const indices = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
    return {
      question: q.question,
      options: indices.map(i => q.options[i]),
      correct_index: indices.indexOf(q.correct_index),
      explanation: q.explanation,
    }
  })
}

async function callOpenAI(system: string, user: string, temperature: number) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature,
    }),
  })
  if (!res.ok) {
    console.error('[assignmentContent] OpenAI error:', await res.text())
    throw new AssignmentGenerationError('Failed to generate assignment content. Please try again.', 502)
  }
  const json = await res.json()
  return JSON.parse(json.choices[0].message.content)
}

function buildTopicPrompts(
  type: AssignmentType,
  topic: string,
  gradeLabel: string,
  neutralityRule: string,
): { system: string; user: string } {
  if (type === 'quiz') {
    return {
      system: `You are an educational quiz writer for ${gradeLabel} students. Create 5 multiple-choice questions about the topic the educator provides.

Rules:
- Exactly 5 questions, vocabulary matching ${gradeLabel} level
- correct_index is 0-based
- All 4 options must be plausible
- ${neutralityRule}

Output valid JSON:
{
  "title": "short descriptive title",
  "questions": [
    {"question": "string", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "brief encouraging explanation"}
  ]
}`,
      user: `Topic: ${topic}\n\nGenerate 5 quiz questions for a ${gradeLabel} student.`,
    }
  }
  if (type === 'flashcards') {
    return {
      system: `You are a flashcard creator for ${gradeLabel} students. Create 8-10 flashcards about the topic.

Rules:
- 8-10 cards, vocabulary matching ${gradeLabel} level
- Fronts short (1-5 words), backs informative (1-2 sentences)
- ${neutralityRule}

Output valid JSON:
{
  "title": "short descriptive title",
  "cards": [{"front": "term", "back": "definition"}]
}`,
      user: `Topic: ${topic}\n\nCreate flashcards for a ${gradeLabel} student.`,
    }
  }
  if (type === 'explain') {
    return {
      system: `You are a patient teacher for ${gradeLabel} students. Explain the topic clearly.

Rules:
- 3-5 sections covering the main ideas
- ${neutralityRule}

Output valid JSON:
{
  "title": "short descriptive title",
  "sections": [{"heading": "string", "content": "2-3 sentence explanation"}],
  "summary": "1-2 sentence key takeaway"
}`,
      user: `Topic: ${topic}\n\nExplain this to a ${gradeLabel} student.`,
    }
  }
  if (type === 'study-guide') {
    return {
      system: `You are an expert study-guide creator for ${gradeLabel} students.

Rules:
- 4-6 key terms, 3-4 main concepts, 3 remember tips, 3-4 practice questions
- ${neutralityRule}

Output valid JSON:
{
  "title": "Study Guide: [topic]",
  "overview": "1-2 sentence overview",
  "key_terms": [{"term": "string", "definition": "string"}],
  "main_concepts": [{"heading": "string", "content": "string"}],
  "remember": ["tip 1", "tip 2", "tip 3"],
  "practice_questions": [{"question": "string", "answer": "string"}]
}`,
      user: `Topic: ${topic}\n\nCreate a study guide for a ${gradeLabel} student.`,
    }
  }
  // reading — generate a passage and 5 comprehension questions
  return {
    system: `You write reading comprehension activities for ${gradeLabel} students.

Rules:
- Passage is 150-300 words, age-appropriate, engaging, on the requested topic
- Exactly 5 multiple-choice questions answerable from the passage
- Mix literal and inferential questions
- correct_index is 0-based
- ${neutralityRule}

Output valid JSON:
{
  "title": "short descriptive title",
  "passage": "the full reading passage as a single string with paragraph breaks",
  "questions": [
    {"question": "string", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "brief explanation citing evidence"}
  ]
}`,
    user: `Topic: ${topic}\n\nWrite a reading passage and 5 comprehension questions for a ${gradeLabel} student.`,
  }
}

function buildReadingMaterialPrompts(
  passage: string,
  gradeLabel: string,
  neutralityRule: string,
): { system: string; user: string } {
  return {
    system: `You create reading comprehension questions for ${gradeLabel} students based on a passage the educator provides.

Rules:
- Exactly 5 multiple-choice questions answerable from or directly inferred from the passage
- Mix literal and inferential questions
- correct_index is 0-based
- ${neutralityRule}

Output valid JSON:
{
  "title": "short descriptive title",
  "questions": [
    {"question": "string", "options": ["A","B","C","D"], "correct_index": 0, "explanation": "brief explanation citing evidence"}
  ]
}`,
    user: `Passage:\n\n${passage}\n\nWrite 5 comprehension questions for a ${gradeLabel} student.`,
  }
}

async function persistQuizSession(
  admin: SupabaseClient,
  questions: QuizQ[],
  grade: number | undefined,
  topic: string | null,
  ipAddress: string | null,
  source: 'classroom-assignment',
): Promise<string> {
  const { data: session, error } = await admin
    .from('quiz_sessions')
    // Educator-authored — no anti-speedrun gate, generous attempts
    .insert({
      questions,
      source,
      ip_address: ipAddress,
      grade: grade ?? null,
      topic,
      min_seconds: 0,
      max_attempts: 10,
    })
    .select('id')
    .single()
  if (error || !session) {
    console.error('[assignmentContent] quiz_sessions insert failed:', error)
    throw new AssignmentGenerationError('Failed to save quiz.', 500)
  }
  return session.id
}

export async function generateAssignmentContent(
  admin: SupabaseClient,
  input: GenerateInput,
  ipAddress: string | null,
): Promise<GenerateResult> {
  const { type, source, grade } = input
  const topic = input.topic?.trim()
  const material = input.material?.trim()

  if (!ASSIGNMENT_TYPES.includes(type)) {
    throw new AssignmentGenerationError('Unsupported assignment type.')
  }
  if (source === 'topic' && (!topic || topic.length < 3)) {
    throw new AssignmentGenerationError('Topic must be at least 3 characters.')
  }
  if (source === 'material' && (!material || material.length < 50)) {
    throw new AssignmentGenerationError('Pasted material must be at least 50 characters.')
  }
  if (material && material.length > 5000) {
    throw new AssignmentGenerationError('Pasted material must be 5000 characters or fewer.')
  }

  const { neutralityRule } = await getActiveGuardrails()
  const gradeLabel = grade ? `grade ${grade}` : 'elementary school'

  // Material-mode for quiz/flashcards/explain/study-guide reuses the existing
  // study-helper prompts so behaviour stays consistent with standalone use.
  let prompts: { system: string; user: string }
  if (source === 'material' && type !== 'reading') {
    prompts = buildPrompts(type as ActivityMode, material!, gradeLabel, neutralityRule)
  } else if (source === 'material' && type === 'reading') {
    prompts = buildReadingMaterialPrompts(material!, gradeLabel, neutralityRule)
  } else {
    prompts = buildTopicPrompts(type, topic!, gradeLabel, neutralityRule)
  }

  const parsed = await callOpenAI(prompts.system, prompts.user, type === 'quiz' || type === 'reading' ? 0.6 : 0.5)

  const baseConfig: Record<string, unknown> = {
    source,
    grade: grade ?? null,
    ...(topic ? { topic } : {}),
    ...(material ? { material } : {}),
  }

  if (type === 'quiz') {
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new AssignmentGenerationError('Could not generate quiz questions.', 502)
    }
    const shuffled = shuffleQuiz(parsed.questions as QuizQ[])
    const sessionId = await persistQuizSession(admin, shuffled, grade, topic ?? null, ipAddress, 'classroom-assignment')
    return {
      content: {
        kind: 'quiz',
        title: parsed.title ?? 'Quiz',
        sessionId,
        questions: shuffled.map(q => ({ question: q.question, options: q.options })),
      },
      config: baseConfig,
    }
  }

  if (type === 'flashcards') {
    if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
      throw new AssignmentGenerationError('Could not generate flashcards.', 502)
    }
    return {
      content: { kind: 'flashcards', title: parsed.title ?? 'Flashcards', cards: parsed.cards },
      config: baseConfig,
    }
  }

  if (type === 'explain') {
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      throw new AssignmentGenerationError('Could not generate explanation.', 502)
    }
    return {
      content: {
        kind: 'explain',
        title: parsed.title ?? 'Explanation',
        sections: parsed.sections,
        summary: parsed.summary ?? '',
      },
      config: baseConfig,
    }
  }

  if (type === 'study-guide') {
    if (!Array.isArray(parsed.key_terms)) {
      throw new AssignmentGenerationError('Could not generate study guide.', 502)
    }
    return {
      content: {
        kind: 'study-guide',
        title: parsed.title ?? 'Study Guide',
        overview: parsed.overview ?? '',
        key_terms: parsed.key_terms ?? [],
        main_concepts: parsed.main_concepts ?? [],
        remember: parsed.remember ?? [],
        practice_questions: parsed.practice_questions ?? [],
      },
      config: baseConfig,
    }
  }

  // reading
  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new AssignmentGenerationError('Could not generate reading questions.', 502)
  }
  const passage = source === 'material' ? material! : (parsed.passage as string | undefined ?? '')
  if (!passage || passage.length < 50) {
    throw new AssignmentGenerationError('Could not generate a reading passage.', 502)
  }
  const shuffled = shuffleQuiz(parsed.questions as QuizQ[])
  const sessionId = await persistQuizSession(admin, shuffled, grade, topic ?? null, ipAddress, 'classroom-assignment')
  return {
    content: {
      kind: 'reading',
      title: parsed.title ?? 'Reading',
      passage,
      sessionId,
      questions: shuffled.map(q => ({ question: q.question, options: q.options })),
    },
    config: baseConfig,
  }
}
