import { NextRequest, NextResponse } from 'next/server'
import { checkLearningRateLimit } from '@/lib/utils/rateLimiter'
import { NEUTRALITY_RULE } from '@/lib/utils/learningGuardrails'
import { getSetting } from '@/lib/settings/appSettings'

export async function POST(request: NextRequest) {
  const limited = await checkLearningRateLimit(request, 'trivia')
  if (limited) return limited

  const triviaEnabled = await getSetting('trivia_enabled', true)
  if (!triviaEnabled) {
    return NextResponse.json({ message: 'Trivia mode is currently unavailable.' }, { status: 403 })
  }

  try {
    const { topic, grade, imageBase64, mimeType } = await request.json() as {
      topic?: string
      grade?: number
      imageBase64?: string
      mimeType?: string
    }

    const gradeLabel = grade ? `grade ${grade}` : 'elementary school'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userContent: any
    if (imageBase64) {
      userContent = [
        { type: 'image_url', image_url: { url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}` } },
        { type: 'text', text: `Generate 10 fun trivia questions for a ${gradeLabel} student based on the content shown in this image.` },
      ]
    } else {
      if (!topic?.trim()) {
        return NextResponse.json({ message: 'Enter a topic.' }, { status: 400 })
      }
      userContent = `Generate 10 fun trivia questions about: ${topic.trim()} (${gradeLabel})`
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You create fun, engaging trivia questions for K-8 students. Mix easy and medium difficulty.

Rules:
- Exactly 10 questions
- 4 answer choices each
- Make questions feel like a fun game show, not a test
- Include a brief fun fact about the correct answer
- ${NEUTRALITY_RULE}

Output valid JSON:
{
  "questions": [
    {
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "fact": "brief fun fact about the correct answer (1 sentence)"
    }
  ]
}`,
          },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      }),
    })

    if (!res.ok) {
      console.error('[trivia] OpenAI error:', await res.text())
      return NextResponse.json({ message: 'Failed to generate trivia.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    if (!parsed.questions?.length) {
      return NextResponse.json({ message: 'Could not generate trivia. Try a different topic.' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[trivia] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
