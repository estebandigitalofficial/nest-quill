import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

// GET — count how many items still need content generated
export async function GET() {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const [{ count: empty }, { count: total }, { count: filled }] = await Promise.all([
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('content', '{}'),
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('is_active', true),
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('is_active', true).neq('content', '{}'),
    ])

    // Breakdown by tool type
    const [{ count: emptyQuiz }, { count: emptyFlash }, { count: emptyGuide }] = await Promise.all([
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('tool_type', 'quiz').eq('content', '{}').eq('is_active', true),
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('tool_type', 'flashcards').eq('content', '{}').eq('is_active', true),
      admin.from('content_library').select('id', { count: 'exact', head: true }).eq('tool_type', 'study-guide').eq('content', '{}').eq('is_active', true),
    ])

    return NextResponse.json({
      empty: empty ?? 0,
      filled: filled ?? 0,
      total: total ?? 0,
      byType: {
        quiz: emptyQuiz ?? 0,
        flashcards: emptyFlash ?? 0,
        'study-guide': emptyGuide ?? 0,
      },
    })
  } catch (err) {
    console.error('[admin/university/generate GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}

// POST — batch generate content for empty library entries
export async function POST(req: NextRequest) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, toolType, limit: batchLimit, grade } = body as {
      id?: string
      toolType?: string
      limit?: number
      grade?: number
    }

    const admin = createAdminClient()
    const maxItems = Math.min(batchLimit ?? 5, 50)

    let query = admin
      .from('content_library')
      .select('id, tool_type, grade, subject, topic, title')
      .eq('is_active', true)
      .eq('content', '{}')
      .order('grade', { ascending: true })
      .limit(maxItems)

    if (id) {
      query = admin
        .from('content_library')
        .select('id, tool_type, grade, subject, topic, title')
        .eq('id', id)
        .limit(1)
    } else {
      if (toolType) query = query.eq('tool_type', toolType)
      if (grade) query = query.eq('grade', grade)
    }

    const { data: items, error } = await query
    if (error) throw error
    if (!items?.length) {
      return NextResponse.json({ message: 'No items need generation.', generated: 0, total: 0 })
    }

    let generated = 0
    const errors: string[] = []

    for (const item of items) {
      try {
        const content = await generateContent(item.tool_type, item.topic, item.grade, item.subject)
        if (content) {
          await admin
            .from('content_library')
            .update({ content, quality: 'auto', updated_at: new Date().toISOString() })
            .eq('id', item.id)
          generated++
        }
      } catch (err) {
        errors.push(`${item.title}: ${(err as Error).message}`)
      }
    }

    return NextResponse.json({
      generated,
      total: items.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[admin/university/generate]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}

async function generateContent(
  toolType: string,
  topic: string,
  grade: number | null,
  subject: string | null
): Promise<Record<string, unknown> | null> {
  const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
  const subjectLabel = subject ? ` for ${subject}` : ''

  let systemPrompt: string
  let userPrompt: string

  switch (toolType) {
    case 'quiz':
      systemPrompt = `You are an expert educational content writer creating accreditation-quality quiz material for ${gradeLabel} students. Create 5 multiple-choice questions aligned with Common Core / state standards.

Rules:
- Questions must be factually accurate and grade-appropriate
- All 4 options must be plausible distractors
- Include clear, encouraging explanations
- Cover different difficulty levels (2 easy, 2 medium, 1 harder)

Output valid JSON:
{
  "questions": [
    {
      "question": "string",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_index": 0,
      "explanation": "brief, encouraging explanation"
    }
  ]
}`
      userPrompt = `Generate 5 standards-aligned quiz questions${subjectLabel} on: ${topic} for a ${gradeLabel} student. Make them educational and accurate.`
      break

    case 'flashcards':
      systemPrompt = `You are an expert educational content writer creating study flashcards for ${gradeLabel} students. Generate exactly 10 cards aligned with Common Core / state standards.

Rules:
- Front: key term, vocabulary word, formula, or concept question
- Back: clear, accurate, age-appropriate definition or answer
- Cover the most important concepts students must know
- Progress from fundamental to more advanced within the topic

Output valid JSON:
{
  "cards": [
    { "front": "term or question", "back": "definition or answer" }
  ]
}`
      userPrompt = `Create 10 standards-aligned flashcards on: ${topic}${subjectLabel} (${gradeLabel}). Cover the essential terms and concepts.`
      break

    case 'study-guide':
      systemPrompt = `You are an expert educational content writer creating comprehensive study guides for ${gradeLabel} students. Align with Common Core / state standards.

Rules:
- Overview should set context and explain why this topic matters
- Key terms must be accurate and grade-appropriate
- Main concepts should build understanding step by step
- Memory tips should use proven mnemonic strategies
- Practice questions should test real understanding, not just recall

Output valid JSON:
{
  "title": "Study Guide title",
  "overview": "2-3 sentence overview explaining what students will learn and why it matters",
  "key_terms": [{ "term": "string", "definition": "string" }],
  "main_concepts": [{ "heading": "string", "content": "2-4 sentences explaining the concept clearly" }],
  "remember": ["memory tip 1", "memory tip 2", "memory tip 3"],
  "practice_questions": [{ "question": "string", "answer": "string" }]
}`
      userPrompt = `Create a comprehensive, standards-aligned study guide on: ${topic}${subjectLabel} (${gradeLabel}). Make it thorough enough for homeschool or classroom use.`
      break

    case 'explain':
      systemPrompt = `You are an expert educational content writer for ${gradeLabel} students.
Output valid JSON:
{
  "summary": "2-3 sentence plain-language summary",
  "analogy": "a relatable real-world analogy",
  "key_points": ["point 1", "point 2", "point 3", "point 4"],
  "fun_fact": "one surprising fact",
  "try_this": "a hands-on activity to try"
}`
      userPrompt = `Explain "${topic}" to a ${gradeLabel} student${subjectLabel}. Make it accurate and educational.`
      break

    default:
      return null
  }

  // Use gpt-4o-mini for bulk generation (faster + cheaper)
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status}`)
  }

  const json = await res.json()
  return JSON.parse(json.choices[0].message.content)
}
