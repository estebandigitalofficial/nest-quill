import { NextRequest, NextResponse } from 'next/server'
import { checkLearningRateLimit } from '@/lib/utils/rateLimiter'

export async function POST(request: NextRequest) {
  const limited = await checkLearningRateLimit(request, 'flashcards')
  if (limited) return limited
  try {
    const { topic, grade } = await request.json() as { topic: string; grade?: number }

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
            content: `You create educational flashcards for ${gradeLabel} students.

Output valid JSON:
{
  "cards": [
    { "front": "term or question", "back": "definition or answer" }
  ]
}

Rules:
- Generate exactly 10 cards
- Front: key term, vocabulary word, or short question
- Back: clear, concise definition or answer appropriate for ${gradeLabel}
- Cover the most important concepts of the topic`,
          },
          {
            role: 'user',
            content: `Create 10 flashcards on: ${topic.trim()} (${gradeLabel})`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ message: 'Failed to generate flashcards.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    return NextResponse.json({ cards: parsed.cards })
  } catch (err) {
    console.error('[learning/flashcards] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
