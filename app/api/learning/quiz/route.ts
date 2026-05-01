import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkLearningRateLimit } from '@/lib/utils/rateLimiter'
import { classifyTopic, CLARIFY_MESSAGE, REDIRECT_MESSAGE, getActiveGuardrails } from '@/lib/utils/learningGuardrails'

const SYSTEM_PROMPT = (gradeLabel: string, neutralityRule: string) => `You are an educational quiz writer for students in ${gradeLabel}. Create 5 multiple-choice questions.

Rules:
- Exactly 5 questions, vocabulary matching ${gradeLabel} level
- correct_index is 0-based
- All 4 options must be plausible
- ${neutralityRule}

Output valid JSON:
{
  "questions": [
    {
      "question": "string",
      "options": ["option A", "option B", "option C", "option D"],
      "correct_index": 0,
      "explanation": "string — brief, encouraging explanation"
    }
  ]
}`

export async function POST(request: NextRequest) {
  const limited = await checkLearningRateLimit(request, 'quiz')
  if (limited) return limited
  const { neutralityRule, politicalClarificationEnabled } = await getActiveGuardrails()
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

      // ── Topic classification (text path only) ─────────────────────────────
      if (politicalClarificationEnabled) {
        const classification = classifyTopic(topic.trim())
        if (classification === 'redirect') {
          return NextResponse.json({ message: REDIRECT_MESSAGE }, { status: 422 })
        }
        if (classification === 'clarify') {
          return NextResponse.json({ message: CLARIFY_MESSAGE }, { status: 422 })
        }
      }

      userContent = `Topic: ${subjectLabel}${topic.trim()}\n\nGenerate 5 quiz questions for a ${gradeLabel} student on this topic.`
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(gradeLabel, neutralityRule) },
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

    // Shuffle each question's options so answer positions differ per session
    type RawQuestion = { question: string; options: string[]; correct_index: number; explanation: string }
    const shuffled: RawQuestion[] = parsed.questions.map((q: RawQuestion) => {
      const indices = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
      return {
        question: q.question,
        options: indices.map(i => q.options[i]),
        correct_index: indices.indexOf(q.correct_index),
        explanation: q.explanation,
      }
    })

    // Store full questions (with correct_index) in DB — never sent to client
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const adminSupabase = createAdminClient()
    const { data: session, error: sessionError } = await adminSupabase
      .from('quiz_sessions')
      .insert({
        questions: shuffled,
        subject: subject ?? null,
        grade: grade ?? null,
        topic: imageBase64 ? null : (topic?.trim() ?? null),
        source: 'standalone',
        ip_address: ip,
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      console.error('[learning/quiz] session insert error:', sessionError)
      return NextResponse.json({ message: 'Failed to create quiz session.' }, { status: 500 })
    }

    // Strip correct_index + explanation before sending to client
    const clientQuestions = shuffled.map(q => ({ question: q.question, options: q.options }))

    return NextResponse.json({ sessionId: session.id, questions: clientQuestions })
  } catch (err) {
    console.error('[learning/quiz] error:', err)
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
