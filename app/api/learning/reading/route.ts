import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, grade } = await request.json() as { text: string; grade?: number }

    if (!text?.trim() || text.trim().length < 50) {
      return NextResponse.json({ message: 'Please paste at least a paragraph of text.' }, { status: 400 })
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
            content: `You create reading comprehension questions for ${gradeLabel} students.

Output valid JSON:
{
  "questions": [
    {
      "question": "string",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_index": 0,
      "explanation": "brief explanation citing evidence from the text"
    }
  ]
}

Rules:
- Exactly 5 questions
- All answers must be found in or directly inferred from the text
- Mix literal (directly stated) and inferential (reading between the lines) questions
- correct_index is 0-based`,
          },
          {
            role: 'user',
            content: `Text to read:\n\n${text.trim()}\n\nGenerate 5 comprehension questions for a ${gradeLabel} student.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ message: 'Failed to generate questions.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    return NextResponse.json({ questions: parsed.questions })
  } catch (err) {
    console.error('[learning/reading] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
