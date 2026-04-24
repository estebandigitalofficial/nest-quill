import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = (gradeLabel: string) => `You are an educational quiz writer. Create 5 multiple-choice questions.

Your output must be valid JSON:
{
  "questions": [
    {
      "question": "string",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_index": 0,
      "explanation": "string — brief, encouraging explanation"
    }
  ]
}

Rules:
- Exactly 5 questions, vocabulary matching ${gradeLabel} level
- correct_index is 0-based
- All 4 options must be plausible`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, subject, grade, imageBase64, mimeType } = body as {
      topic?: string
      subject?: string
      grade?: number
      imageBase64?: string
      mimeType?: string
    }

    const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
    const subjectLabel = subject ? `${subject} — ` : ''

    // Build the user message — text or image+text
    let userContent: object | string
    if (imageBase64) {
      userContent = [
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}` },
        },
        {
          type: 'text',
          text: `Generate 5 quiz questions for a ${gradeLabel} student based on the content shown in this image.${subject ? ` Subject: ${subject}.` : ''}`,
        },
      ]
    } else {
      if (!topic || topic.trim().length < 3) {
        return NextResponse.json({ message: 'Please enter a topic (at least 3 characters).' }, { status: 400 })
      }
      userContent = `Topic: ${subjectLabel}${topic.trim()}\n\nGenerate 5 quiz questions for a ${gradeLabel} student on this topic.`
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(gradeLabel) },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      console.error('[learning/quiz] OpenAI error:', await res.text())
      return NextResponse.json({ message: 'Failed to generate quiz. Please try again.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    if (!parsed.questions?.length) {
      return NextResponse.json({ message: 'Could not generate quiz. Try a more specific topic.' }, { status: 500 })
    }

    return NextResponse.json({ questions: parsed.questions })
  } catch (err) {
    console.error('[learning/quiz] error:', err)
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
