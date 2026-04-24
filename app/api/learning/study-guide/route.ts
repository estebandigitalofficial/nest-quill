import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { topic, subject, grade } = await request.json() as { topic: string; subject?: string; grade?: number }

    if (!topic?.trim() || topic.trim().length < 3) {
      return NextResponse.json({ message: 'Please enter a topic.' }, { status: 400 })
    }

    const gradeLabel = grade ? `grade ${grade}` : 'elementary school'

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You create study guides for ${gradeLabel} students. Be clear, organized, and age-appropriate.

Output valid JSON:
{
  "title": "Study Guide title",
  "overview": "2-3 sentence overview of the topic",
  "key_terms": [
    { "term": "string", "definition": "string" }
  ],
  "main_concepts": [
    { "heading": "string", "content": "string — 2-4 sentences" }
  ],
  "remember": ["short tip 1", "short tip 2", "short tip 3"],
  "practice_questions": [
    { "question": "string", "answer": "string" }
  ]
}

Rules:
- 6-8 key terms
- 3-4 main concepts
- 3 remember tips (like memory tricks or key takeaways)
- 3 practice questions with answers`,
          },
          {
            role: 'user',
            content: `Create a study guide for: ${topic.trim()}${subject ? ` (${subject})` : ''}, ${gradeLabel}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ message: 'Failed to generate study guide.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[learning/study-guide] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
