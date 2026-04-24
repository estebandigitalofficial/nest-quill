import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ classId: string }> }

// GET — class detail: members + assignments + submission counts
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify educator owns this class
    const { data: classroom, error: clsError } = await admin
      .from('classrooms')
      .select('id, name, grade, subject, join_code, created_at')
      .eq('id', classId)
      .eq('educator_id', user.id)
      .single()

    if (clsError || !classroom) {
      return NextResponse.json({ message: 'Class not found.' }, { status: 404 })
    }

    const [membersRes, assignmentsRes] = await Promise.all([
      admin
        .from('classroom_members')
        .select('id, student_id, joined_at, profiles(display_name, email)')
        .eq('classroom_id', classId)
        .order('joined_at', { ascending: true }),
      admin
        .from('assignments')
        .select(`
          id, title, tool, config, due_at, created_at,
          assignment_submissions(student_id, status, score, total, completed_at)
        `)
        .eq('classroom_id', classId)
        .order('created_at', { ascending: false }),
    ])

    return NextResponse.json({
      classroom,
      members: membersRes.data ?? [],
      assignments: assignmentsRes.data ?? [],
    })
  } catch (err) {
    console.error('[classroom/classes/[classId] GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}

// DELETE — archive (deactivate) a class
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { error } = await admin
      .from('classrooms')
      .update({ is_active: false })
      .eq('id', classId)
      .eq('educator_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[classroom/classes/[classId] DELETE]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
