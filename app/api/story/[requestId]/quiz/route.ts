import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toApiError } from '@/lib/utils/errors'
import type { StoryRequest } from '@/types/database'

type RouteContext = { params: Promise<{ requestId: string }> }

// ── GET /api/story/[requestId]/quiz ───────────────────────────────────────────
// Returns the quiz for a completed learning story.
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { requestId } = await params
    const adminSupabase = createAdminClient()

    const { data: storyReq, error: reqError } = await adminSupabase
      .from('story_requests')
      .select('id, user_id, guest_token, status')
      .eq('id', requestId)
      .single()

    if (reqError || !storyReq) {
      return NextResponse.json({ message: 'Story not found' }, { status: 404 })
    }

    const req = storyReq as unknown as Pick<StoryRequest, 'id' | 'user_id' | 'guest_token' | 'status'>

    // Only serve quiz for complete stories (UUID is the capability token)
    if (req.status !== 'complete') {
      return NextResponse.json({ message: 'Story not yet complete' }, { status: 404 })
    }

    const { data: quiz, error: quizError } = await adminSupabase
      .from('story_quizzes')
      .select('id, subject, grade, topic, questions')
      .eq('request_id', requestId)
      .single()

    if (quizError || !quiz) {
      return NextResponse.json({ message: 'No quiz for this story' }, { status: 404 })
    }

    const questions = (quiz.questions as Array<{ question: string; options: string[]; correct_index: number; explanation: string }>)
      .map(({ question, options }) => ({ question, options }))

    return NextResponse.json({
      quizId: quiz.id,
      subject: quiz.subject,
      grade: quiz.grade,
      topic: quiz.topic,
      questions,
    })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}

// ── POST /api/story/[requestId]/quiz ─────────────────────────────────────────
// Saves a quiz result and returns score + answer feedback.
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { requestId } = await params
    const body = await request.json()
    const { quizId, answers } = body as {
      quizId: string
      answers: { question_index: number; selected_index: number }[]
    }

    if (!quizId || !Array.isArray(answers)) {
      return NextResponse.json({ message: 'Missing quizId or answers' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const cookieStore = await cookies()
    const guestToken = cookieStore.get('guest_token')?.value ?? null

    const adminSupabase = createAdminClient()

    const { data: quiz, error: quizError } = await adminSupabase
      .from('story_quizzes')
      .select('id, questions')
      .eq('id', quizId)
      .eq('request_id', requestId)
      .single()

    if (quizError || !quiz) {
      return NextResponse.json({ message: 'Quiz not found' }, { status: 404 })
    }

    const questions = quiz.questions as Array<{
      question: string
      options: [string, string, string, string]
      correct_index: 0 | 1 | 2 | 3
      explanation: string
    }>

    const gradedAnswers = answers.map(a => ({
      question_index: a.question_index,
      selected_index: a.selected_index,
      correct: a.selected_index === questions[a.question_index]?.correct_index,
    }))

    const score = gradedAnswers.filter(a => a.correct).length
    const total = questions.length

    await adminSupabase.from('quiz_results').insert({
      request_id: requestId,
      user_id: user?.id ?? null,
      guest_token: guestToken,
      score,
      total,
      answers: gradedAnswers,
    })

    // Return feedback (correct answers + explanations)
    const feedback = questions.map((q, i) => ({
      correct_index: q.correct_index,
      explanation: q.explanation,
    }))

    return NextResponse.json({ score, total, feedback })
  } catch (err) {
    const { message, code, statusCode } = toApiError(err)
    return NextResponse.json({ message, code }, { status: statusCode })
  }
}
