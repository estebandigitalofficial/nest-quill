import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { topic, grade } = await request.json() as { topic: string; grade?: number }

    if (!topic?.trim()) {
      return NextResponse.json({ message: 'Please select a topic.' }, { status: 400 })
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
            content: `You create math practice problems for ${gradeLabel} students.

Output valid JSON:
{
  "problems": [
    {
      "problem": "the math problem as a string",
      "answer": "the final answer",
      "steps": ["step 1", "step 2", "step 3"]
    }
  ]
}

Rules:
- Generate exactly 8 problems
- Difficulty appropriate for ${gradeLabel}
- Steps should show clear working — don't just give the answer
- Mix difficulty slightly (start easier, end harder)
- For word problems, use relatable real-life scenarios with kids' names`,
          },
          {
            role: 'user',
            content: `Generate 8 ${topic} practice problems for a ${gradeLabel} student.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ message: 'Failed to generate problems.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    return NextResponse.json({ problems: parsed.problems })
  } catch (err) {
    console.error('[learning/math] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
