import { NextRequest, NextResponse } from 'next/server'
import { gateLearningTools } from '@/lib/settings/gates'
import { checkLearningRateLimit } from '@/lib/utils/rateLimiter'
import { classifyTopic, CLARIFY_MESSAGE, REDIRECT_MESSAGE, getActiveGuardrails } from '@/lib/utils/learningGuardrails'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrNull, storeContent, recordUsage } from '@/lib/services/contentLibrary'
import { UTILITY_MODEL, chatCompletion } from '@/lib/ai/models'

export async function POST(request: NextRequest) {
  const blocked = await gateLearningTools()
  if (blocked) return blocked
  const limited = await checkLearningRateLimit(request, 'flashcards')
  if (limited) return limited
  const { neutralityRule, politicalClarificationEnabled } = await getActiveGuardrails()
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
        { type: 'text', text: `Create 10 flashcards for a ${gradeLabel} student based on the content shown in this image.` },
      ]
    } else {
      if (!topic?.trim() || topic.trim().length < 3) {
        return NextResponse.json({ message: 'Please enter a topic.' }, { status: 400 })
      }

      if (politicalClarificationEnabled) {
        const classification = classifyTopic(topic.trim())
        if (classification === 'redirect') {
          return NextResponse.json({ message: REDIRECT_MESSAGE }, { status: 422 })
        }
        if (classification === 'clarify') {
          return NextResponse.json({ message: CLARIFY_MESSAGE }, { status: 422 })
        }
      }

      userContent = `Create 10 flashcards on: ${topic.trim()} (${gradeLabel})`

      // ── Cache-first: check content library ──────────────────────────────
      const admin = createAdminClient()
      const cached = await getOrNull(admin, {
        toolType: 'flashcards',
        topic: topic.trim(),
        grade: grade ?? null,
      })

      if (cached?.content?.cards) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
        await recordUsage(admin, cached.id, { toolType: 'flashcards', ip })
        return NextResponse.json({ cards: cached.content.cards, fromLibrary: true })
      }
    }

    const res = await chatCompletion({
      model: UTILITY_MODEL,
      messages: [
        {
          role: 'system',
          content: `You create educational flashcards for ${gradeLabel} students.

Rules:
- Generate exactly 10 cards
- Front: key term, vocabulary word, or short question
- Back: clear, concise definition or answer appropriate for ${gradeLabel}
- Cover the most important concepts of the topic
- ${neutralityRule}

Output valid JSON:
{
  "cards": [
    { "front": "term or question", "back": "definition or answer" }
  ]
}`,
        },
        {
          role: 'user',
          content: userContent,
        },
      ],
      jsonMode: true,
      temperature: 0.6,
    })

    if (!res.ok) {
      console.error('[learning/flashcards] OpenAI error:', await res.text())
      return NextResponse.json({ message: 'Failed to generate flashcards.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    // Store in content library (text-based only)
    if (!imageBase64 && topic?.trim() && parsed.cards?.length) {
      const admin = createAdminClient()
      storeContent(admin, {
        toolType: 'flashcards',
        topic: topic.trim(),
        title: `Flashcards: ${topic.trim()}`,
        content: { cards: parsed.cards },
        grade: grade ?? null,
        source: 'ai',
      })
    }

    return NextResponse.json({ cards: parsed.cards })
  } catch (err) {
    console.error('[learning/flashcards] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
