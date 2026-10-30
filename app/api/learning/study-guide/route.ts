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
  const limited = await checkLearningRateLimit(request, 'study-guide')
  if (limited) return limited
  const { neutralityRule, politicalClarificationEnabled } = await getActiveGuardrails()
  try {
    const { topic, subject, grade, imageBase64, mimeType } = await request.json() as {
      topic?: string
      subject?: string
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
        { type: 'text', text: `Create a study guide for a ${gradeLabel} student${subject ? ` for ${subject}` : ''} based on the content shown in this image.` },
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

      userContent = `Create a study guide for: ${topic.trim()}${subject ? ` (${subject})` : ''}, ${gradeLabel}`

      // ── Cache-first: check content library ──────────────────────────────
      const admin = createAdminClient()
      const cached = await getOrNull(admin, {
        toolType: 'study-guide',
        topic: topic.trim(),
        grade: grade ?? null,
        subject: subject ?? null,
      })

      if (cached?.content?.title) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
        await recordUsage(admin, cached.id, { toolType: 'study-guide', ip })
        return NextResponse.json({ ...cached.content, fromLibrary: true })
      }
    }

    const res = await chatCompletion({
      model: UTILITY_MODEL,
      messages: [
        {
          role: 'system',
          content: `You create study guides for ${gradeLabel} students. Be clear, organized, and age-appropriate.

Rules:
- 6-8 key terms
- 3-4 main concepts
- 3 remember tips (memory tricks or key takeaways)
- 3 practice questions with answers
- ${neutralityRule}

Output valid JSON:
{
  "title": "Study Guide title",
  "overview": "2-3 sentence overview of the topic",
  "key_terms": [
    { "term": "string", "definition": "string" }
  ],
  "main_concepts": [
    { "heading": "string", "content": "string — 2-4 sentences" }
  ],
  "remember": ["short tip 1", "short tip 2", "short tip 3"],
  "practice_questions": [
    { "question": "string", "answer": "string" }
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
      console.error('[learning/study-guide] OpenAI error:', await res.text())
      return NextResponse.json({ message: 'Failed to generate study guide.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    // Store in content library (text-based only)
    if (!imageBase64 && topic?.trim() && parsed.title) {
      const admin = createAdminClient()
      storeContent(admin, {
        toolType: 'study-guide',
        topic: topic.trim(),
        title: parsed.title,
        content: parsed,
        grade: grade ?? null,
        subject: subject ?? null,
        source: 'ai',
      })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[learning/study-guide] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
