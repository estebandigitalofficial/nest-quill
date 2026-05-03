import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

// POST — batch generate content for empty library entries
// Generates AI content for items where content is '{}'
export async function POST(req: NextRequest) {
  try {
    const adminCtx = await getAdminContext()
    if (!adminCtx) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, toolType, limit: batchLimit } = body as {
      id?: string           // generate for a single item
      toolType?: string     // generate for all empty items of this type
      limit?: number        // max items to generate (default 5)
    }

    const admin = createAdminClient()
    const maxItems = Math.min(batchLimit ?? 5, 20)

    // Find items that need content generated
    let query = admin
      .from('content_library')
      .select('id, tool_type, grade, subject, topic, title')
      .eq('is_active', true)
      .eq('content', '{}')
      .limit(maxItems)

    if (id) {
      query = admin
        .from('content_library')
        .select('id, tool_type, grade, subject, topic, title')
        .eq('id', id)
        .limit(1)
    } else if (toolType) {
      query = query.eq('tool_type', toolType)
    }

    const { data: items, error } = await query
    if (error) throw error
    if (!items?.length) {
      return NextResponse.json({ message: 'No items need generation.', generated: 0 })
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
      systemPrompt = `You are an educational quiz writer for students in ${gradeLabel}. Create 5 multiple-choice questions.
Output valid JSON:
{
  "questions": [
    {
      "question": "string",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_index": 0,
      "explanation": "brief explanation"
    }
  ]
}`
      userPrompt = `Generate 5 quiz questions${subjectLabel} on: ${topic} for a ${gradeLabel} student.`
      break

    case 'flashcards':
      systemPrompt = `You create educational flashcards for ${gradeLabel} students. Generate exactly 10 cards.
Output valid JSON:
{
  "cards": [
    { "front": "term or question", "back": "definition or answer" }
  ]
}`
      userPrompt = `Create 10 flashcards on: ${topic}${subjectLabel} (${gradeLabel})`
      break

    case 'study-guide':
      systemPrompt = `You create study guides for ${gradeLabel} students.
Output valid JSON:
{
  "title": "Study Guide title",
  "overview": "2-3 sentence overview",
  "key_terms": [{ "term": "string", "definition": "string" }],
  "main_concepts": [{ "heading": "string", "content": "2-4 sentences" }],
  "remember": ["tip 1", "tip 2", "tip 3"],
  "practice_questions": [{ "question": "string", "answer": "string" }]
}`
      userPrompt = `Create a study guide on: ${topic}${subjectLabel} (${gradeLabel})`
      break

    case 'explain':
      systemPrompt = `You are an educational assistant for ${gradeLabel} students.
Output valid JSON:
{
  "summary": "2-3 sentence summary",
  "analogy": "relatable analogy",
  "key_points": ["point 1", "point 2", "point 3", "point 4"],
  "fun_fact": "interesting fact",
  "try_this": "hands-on activity"
}`
      userPrompt = `Explain "${topic}" to a ${gradeLabel} student${subjectLabel}.`
      break

    default:
      return null
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
    }),
  })

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status}`)
  }

  const json = await res.json()
  return JSON.parse(json.choices[0].message.content)
}
