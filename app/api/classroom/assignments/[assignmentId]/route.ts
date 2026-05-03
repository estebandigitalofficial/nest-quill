import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ assignmentId: string }> }

// GET — fetch a single assignment for the current student. Returns the
// educator-authored content along with any prior submission status, so the
// student page can render and resume.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { assignmentId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: assignment } = await admin
      .from('assignments')
      .select('id, title, tool, config, content, due_at, created_at, classroom_id, classrooms(name)')
      .eq('id', assignmentId)
      .single()
    if (!assignment) return NextResponse.json({ message: 'Assignment not found.' }, { status: 404 })

    // Educator authoring the class can view too — useful for previewing.
    const [{ data: membership }, { data: ownedClass }] = await Promise.all([
      admin.from('classroom_members')
        .select('id')
        .eq('classroom_id', assignment.classroom_id)
        .eq('student_id', user.id)
        .maybeSingle(),
      admin.from('classrooms')
        .select('id')
        .eq('id', assignment.classroom_id)
        .eq('educator_id', user.id)
        .maybeSingle(),
    ])
    if (!membership && !ownedClass) {
      return NextResponse.json({ message: 'You are not enrolled in this class.' }, { status: 403 })
    }

    const { data: submission } = await admin
      .from('assignment_submissions')
      .select('id, status, score, total, completed_at, started_at')
      .eq('assignment_id', assignmentId)
      .eq('student_id', user.id)
      .maybeSingle()

    const classroomName = (assignment.classrooms as unknown as { name: string } | null)?.name ?? null

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        type: assignment.tool,
        config: assignment.config,
        content: assignment.content,
        due_at: assignment.due_at,
        classroom_id: assignment.classroom_id,
        classroom_name: classroomName,
      },
      submission: submission ?? null,
    })
  } catch (err) {
    console.error('[classroom/assignments GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
