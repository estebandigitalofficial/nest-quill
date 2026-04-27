import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkLearningRateLimit } from '@/lib/utils/rateLimiter'
import { buildPrompts, VALID_ACTIVITY_MODES, ActivityMode } from '@/lib/services/materialActivity'

export async function POST(request: NextRequest) {
  // Parse body first so we can check assignmentId before rate limiting
  let body: { material?: string; mode?: string; grade?: number; assignmentId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request.' }, { status: 400 })
  }

  const { assignmentId } = body
  let { material, mode, grade } = body

  const admin = createAdminClient()

  // When assignmentId is present, pull material/mode/grade from DB (not body)
  if (assignmentId) {
    const { data: assignment } = await admin
      .from('assignments')
      .select('config')
      .eq('id', assignmentId)
      .eq('tool', 'study-helper')
      .single()

    if (!assignment) {
      return NextResponse.json({ message: 'Assignment not found.' }, { status: 404 })
    }

    const cfg = assignment.config as { material?: string; mode?: string; grade?: number }
    material = cfg.material
    mode = cfg.mode
    grade = cfg.grade
  }

  const rateLimitKey = assignmentId ? 'study-helper-assignment' : 'study-helper'
  const limited = await checkLearningRateLimit(request, rateLimitKey)
  if (limited) return limited

  try {
    if (!material || material.trim().length < 50) {
      return NextResponse.json({ message: 'Please paste at least 50 characters of material.' }, { status: 400 })
    }
    if (material.length > 5000) {
      return NextResponse.json({ message: 'Material is too long. Please limit to 5000 characters.' }, { status: 400 })
    }
    if (!VALID_ACTIVITY_MODES.includes(mode as ActivityMode)) {
      return NextResponse.json({ message: 'Invalid mode.' }, { status: 400 })
    }

    const gradeLabel = grade ? `grade ${grade}` : 'elementary school'
    const { system, user: userPrompt } = buildPrompts(mode as ActivityMode, material, gradeLabel)

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
      }),
    })

    if (!res.ok) {
      console.error('[study-helper/generate] OpenAI error:', await res.text())
      return NextResponse.json({ message: 'Failed to generate content. Please try again.' }, { status: 500 })
    }

    const json = await res.json()
    const parsed = JSON.parse(json.choices[0].message.content)

    if (mode === 'quiz') {
      if (!parsed.questions?.length) {
        return NextResponse.json({ message: 'Could not generate quiz. Please try again.' }, { status: 500 })
      }

      type RawQ = { question: string; options: string[]; correct_index: number; explanation: string }
      const shuffled: RawQ[] = parsed.questions.map((q: RawQ) => {
        const indices = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
        return {
          question: q.question,
          options: indices.map(i => q.options[i]),
          correct_index: indices.indexOf(q.correct_index),
          explanation: q.explanation,
        }
      })

      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      const { data: session, error } = await admin
        .from('quiz_sessions')
        .insert({ questions: shuffled, source: 'study-helper', ip_address: ip, grade: grade ?? null, min_seconds: 0 })
        .select('id')
        .single()

      if (error || !session) {
        console.error('[study-helper/generate] quiz_sessions insert error:', error)
        return NextResponse.json({ message: 'Failed to create quiz session.' }, { status: 500 })
      }

      return NextResponse.json({
        title: parsed.title ?? 'Quiz',
        sessionId: session.id,
        questions: shuffled.map(q => ({ question: q.question, options: q.options })),
      })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[study-helper/generate] error:', err)
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
