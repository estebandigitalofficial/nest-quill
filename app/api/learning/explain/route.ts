import { NextRequest, NextResponse } from 'next/server'
import { checkLearningRateLimit } from '@/lib/utils/rateLimiter'
import { classifyTopic, CLARIFY_MESSAGE, REDIRECT_MESSAGE, NEUTRALITY_RULE } from '@/lib/utils/learningGuardrails'

export async function POST(request: NextRequest) {
  const limited = await checkLearningRateLimit(request, 'explain')
  if (limited) return limited

  try {
    const { topic, grade, imageBase64, mimeType } = await request.json() as {
      topic?: string
      grade?: number
      imageBase64?: string
      mimeType?: string
    }

    const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
    const ageLabel   = grade ? `a ${4 + grade}-${5 + grade} year old` : 'a young student'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userContent: any
    if (imageBase64) {
      userContent = [
        { type: 'image_url', image_url: { url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}` } },
        { type: 'text', text: `Explain the main concept shown in this image to a ${gradeLabel} student.` },
      ]
    } else {
      const topicTrimmed = topic?.trim() ?? ''

      if (topicTrimmed.length < 10) {
        return NextResponse.json(
          { message: 'Please enter a more specific topic (at least 10 characters) so I can explain it well.' },
          { status: 400 }
        )
      }
      if (topicTrimmed.length > 1000) {
        return NextResponse.json(
          { message: 'That topic is a bit long. Try shortening it to a single concept or question.' },
          { status: 400 }
        )
      }

      const classification = classifyTopic(topicTrimmed)
      if (classification === 'redirect') {
        return NextResponse.json({ message: REDIRECT_MESSAGE }, { status: 422 })
      }
      if (classification === 'clarify') {
        return NextResponse.json({ message: CLARIFY_MESSAGE }, { status: 422 })
      }

      userContent = `Explain "${topicTrimmed}" to a ${gradeLabel} student.`
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an educational assistant for students (grades 1–8). You are explaining to ${ageLabel} in ${gradeLabel}.

Explain concepts in a simple, clear, and age-appropriate way.

Rules:
- Focus on helping the student understand step-by-step
- Do not provide direct answers to tests or assignments
- Keep explanations neutral, factual, and easy to understand
- Do not engage in political opinions, debates, persuasion, or advocacy
- Do not show political, cultural, religious, or social bias
- Present information in a balanced, neutral way
- Avoid framing one side, group, belief, or viewpoint as better or worse
- Avoid current events or controversial modern topics unless clearly handled as neutral educational content

Handling political topics:
- If the topic is clearly historical or civics-related (e.g., Constitution, branches of government, past events), explain it normally in a neutral, educational way
- If the topic is vague or could be modern/political, ask a clarifying question instead of answering
- Never take sides or express opinions

If a topic is unclear or not appropriate, gently guide the student toward a safe, school-related explanation.

${NEUTRALITY_RULE}

Output valid JSON:
{
  "summary": "2-3 sentence plain-language summary",
  "analogy": "a relatable real-world analogy that makes it click",
  "key_points": ["point 1", "point 2", "point 3", "point 4"],
  "fun_fact": "one surprising or interesting fact about this topic",
  "try_this": "a simple hands-on activity or thing to try at home"
}`,
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      console.error('[learning/explain] OpenAI error:', await res.text())
      return NextResponse.json({ message: 'Failed to generate explanation.' }, { status: 500 })
    }

    const json   = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[learning/explain] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
