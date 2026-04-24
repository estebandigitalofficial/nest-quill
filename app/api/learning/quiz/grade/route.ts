import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, answers, elapsedSeconds } = body as {
      sessionId: string
      answers: number[]          // client's selected index per question (0-3)
      elapsedSeconds: number
    }

    if (!sessionId || !Array.isArray(answers) || typeof elapsedSeconds !== 'number') {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()
    const { data: session, error: sessionError } = await adminSupabase
      .from('quiz_sessions')
      .select('id, questions, attempt_count, max_attempts, min_seconds, expires_at, started_at')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ message: 'Quiz session not found.' }, { status: 404 })
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ message: 'This quiz session has expired. Please generate a new quiz.' }, { status: 410 })
    }

    if (session.attempt_count >= session.max_attempts) {
      return NextResponse.json({ message: `Maximum attempts (${session.max_attempts}) reached.` }, { status: 429 })
    }

    if (elapsedSeconds < session.min_seconds) {
      return NextResponse.json({ message: 'Quiz completed too quickly. Please take your time.' }, { status: 422 })
    }

    const questions = session.questions as Array<{
      question: string
      options: string[]
      correct_index: number
      explanation: string
    }>

    if (answers.length !== questions.length) {
      return NextResponse.json({ message: 'Answer count does not match question count.' }, { status: 400 })
    }

    const score = answers.filter((a, i) => a === questions[i].correct_index).length
    const total = questions.length
    const feedback = questions.map((q, i) => ({
      correct_index: q.correct_index,
      explanation: q.explanation,
      your_answer: answers[i],
    }))

    await adminSupabase
      .from('quiz_sessions')
      .update({
        attempt_count: session.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    return NextResponse.json({ score, total, feedback })
  } catch (err) {
    console.error('[learning/quiz/grade] error:', err)
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
