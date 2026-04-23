import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, subject, grade } = body as { topic: string; subject?: string; grade?: number }

    if (!topic || topic.trim().length < 3) {
      return NextResponse.json({ message: 'Please enter a topic (at least 3 characters).' }, { status: 400 })
    }

    const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
    const subjectLabel = subject ? `${subject} — ` : ''

    const messages = [
      {
        role: 'system',
        content: `You are an educational quiz writer. Create 5 multiple-choice questions for a ${gradeLabel} student.

Your output must be valid JSON matching this exact structure:
{
  "questions": [
    {
      "question": "string — the question text",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_index": 0,
      "explanation": "string — brief, encouraging explanation of why this answer is correct"
    }
  ]
}

Rules:
- Write exactly 5 questions
- Vocabulary and complexity must match ${gradeLabel} level
- Mix factual recall with applied understanding
- correct_index is 0-based (0 = A, 3 = D)
- Explanations should be encouraging and brief (1-2 sentences)
- All 4 options must be plausible, not obviously wrong`,
      },
      {
        role: 'user',
        content: `Topic: ${subjectLabel}${topic.trim()}\n\nGenerate 5 quiz questions for a ${gradeLabel} student on this topic.`,
      },
    ]

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[learning/quiz] OpenAI error:', err)
      return NextResponse.json({ message: 'Failed to generate quiz. Please try again.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return NextResponse.json({ message: 'Could not generate quiz. Try a more specific topic.' }, { status: 500 })
    }

    return NextResponse.json({ questions: parsed.questions })
  } catch (err) {
    console.error('[learning/quiz] error:', err)
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
