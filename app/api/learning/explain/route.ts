import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { topic, grade } = await request.json() as { topic: string; grade?: number }

    if (!topic?.trim() || topic.trim().length < 3) {
      return NextResponse.json({ message: 'Please enter a topic.' }, { status: 400 })
    }

    const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
    const ageLabel = grade ? `a ${4 + grade}-${5 + grade} year old` : 'a young student'

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You explain concepts to ${ageLabel} in ${gradeLabel}. Be warm, clear, and use simple language.

Output valid JSON:
{
  "summary": "2-3 sentence plain-language summary",
  "analogy": "a relatable real-world analogy that makes it click",
  "key_points": ["point 1", "point 2", "point 3", "point 4"],
  "fun_fact": "one surprising or interesting fact about this topic",
  "try_this": "a simple hands-on activity or thing to try at home"
}

Keep everything age-appropriate and encouraging.`,
          },
          {
            role: 'user',
            content: `Explain "${topic.trim()}" to a ${gradeLabel} student.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ message: 'Failed to generate explanation.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[learning/explain] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
