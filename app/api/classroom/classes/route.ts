import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdminNotification, buildNewClassroomEmail } from '@/lib/services/adminNotifications'

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// GET — list classes for the current user (educator or student)
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const accountType = user.user_metadata?.account_type ?? 'parent'

    if (accountType === 'educator') {
      const { data, error } = await admin
        .from('classrooms')
        .select(`
          id, name, grade, subject, join_code, is_active, created_at,
          classroom_members(count),
          assignments(count)
        `)
        .eq('educator_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return NextResponse.json({ classrooms: data })
    }

    // Student: return classrooms they belong to
    const { data, error } = await admin
      .from('classroom_members')
      .select(`
        joined_at,
        classrooms(id, name, grade, subject, educator_id,
          assignments(id, title, tool, due_at,
            assignment_submissions(status, score, total, completed_at)
          )
        )
      `)
      .eq('student_id', user.id)

    if (error) throw error
    return NextResponse.json({ memberships: data })
  } catch (err) {
    console.error('[classroom/classes GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}

// POST — create a new classroom (educator only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const accountType = user.user_metadata?.account_type ?? 'parent'
    if (accountType !== 'educator') {
      return NextResponse.json({ message: 'Only educators can create classes.' }, { status: 403 })
    }

    const { name, grade, subject } = await request.json() as {
      name: string
      grade?: number
      subject?: string
    }

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ message: 'Class name must be at least 2 characters.' }, { status: 400 })
    }

    // Generate a unique join code
    const admin = createAdminClient()
    let joinCode = generateJoinCode()
    let attempts = 0
    while (attempts < 5) {
      const { data: existing } = await admin.from('classrooms').select('id').eq('join_code', joinCode).single()
      if (!existing) break
      joinCode = generateJoinCode()
      attempts++
    }

    const { data, error } = await admin
      .from('classrooms')
      .insert({
        educator_id: user.id,
        name: name.trim(),
        grade: grade ?? null,
        subject: subject?.trim() || null,
        join_code: joinCode,
      })
      .select('id, name, grade, subject, join_code, created_at')
      .single()

    if (error) throw error

    after(async () => {
      try {
        const { subject, html } = buildNewClassroomEmail({
          classroomId: data.id,
          name: data.name,
          educatorEmail: user.email!,
          grade: data.grade ?? null,
          subject: data.subject ?? null,
        })
        await sendAdminNotification('new_classroom_created', subject, html)
      } catch { /* non-blocking */ }
    })

    return NextResponse.json({ classroom: data }, { status: 201 })
  } catch (err) {
    console.error('[classroom/classes POST]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
