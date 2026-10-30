import { NextRequest, NextResponse } from 'next/server'
import { gateLearningTools } from '@/lib/settings/gates'
import { checkLearningRateLimit } from '@/lib/utils/rateLimiter'
import { getActiveGuardrails } from '@/lib/utils/learningGuardrails'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrNull, storeContent, recordUsage } from '@/lib/services/contentLibrary'
import { UTILITY_MODEL, chatCompletion } from '@/lib/ai/models'

export async function POST(request: NextRequest) {
  const blocked = await gateLearningTools()
  if (blocked) return blocked
  const limited = await checkLearningRateLimit(request, 'math')
  if (limited) return limited
  const { neutralityRule } = await getActiveGuardrails()
  try {
    const { topic, grade } = await request.json() as { topic: string; grade?: number }

    if (!topic?.trim()) {
      return NextResponse.json({ message: 'Please select a topic.' }, { status: 400 })
    }

    const gradeLabel = grade ? `grade ${grade}` : 'elementary school'

    // ── Cache-first ─────────────────────────────────────────────────────
    const admin = createAdminClient()
    const cached = await getOrNull(admin, { toolType: 'math', topic: topic.trim(), grade: grade ?? null, subject: 'Math' })
    if (cached?.content?.problems) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      await recordUsage(admin, cached.id, { toolType: 'math', ip })
      return NextResponse.json({ problems: cached.content.problems, fromLibrary: true })
    }

    const res = await chatCompletion({
      model: UTILITY_MODEL,
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
- For word problems, use relatable real-life scenarios with kids' names
- ${neutralityRule}`,
        },
        {
          role: 'user',
          content: `Generate 8 ${topic} practice problems for a ${gradeLabel} student.`,
        },
      ],
      jsonMode: true,
      temperature: 0.5,
    })

    if (!res.ok) {
      return NextResponse.json({ message: 'Failed to generate problems.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    // Store in library
    if (topic?.trim() && parsed.problems?.length) {
      storeContent(admin, {
        toolType: 'math',
        topic: topic.trim(),
        title: `Math: ${topic.trim()}`,
        content: { problems: parsed.problems },
        grade: grade ?? null,
        subject: 'Math',
        source: 'ai',
      })
    }

    return NextResponse.json({ problems: parsed.problems })
  } catch (err) {
    console.error('[learning/math] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
