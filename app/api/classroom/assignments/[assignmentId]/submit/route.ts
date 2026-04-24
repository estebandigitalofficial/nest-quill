import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ assignmentId: string }> }

// POST — student submits / marks an assignment complete
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { assignmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const { score, total, quizSessionId } = await request.json() as {
      score?: number
      total?: number
      quizSessionId?: string
    }

    const admin = createAdminClient()

    // Upsert submission — student can only submit once per assignment (unique constraint)
    const { data, error } = await admin
      .from('assignment_submissions')
      .upsert({
        assignment_id: assignmentId,
        student_id: user.id,
        quiz_session_id: quizSessionId ?? null,
        score: score ?? null,
        total: total ?? null,
        status: 'complete',
        completed_at: new Date().toISOString(),
      }, { onConflict: 'assignment_id,student_id' })
      .select('id, status, score, total, completed_at')
      .single()

    if (error) throw error
    return NextResponse.json({ submission: data })
  } catch (err) {
    console.error('[classroom/assignments/submit POST]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
