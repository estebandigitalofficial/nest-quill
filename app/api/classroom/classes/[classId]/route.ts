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

    const members = membersRes.data ?? []

    // Fetch student profiles + badge counts for all members
    const studentIds = members.map((m: { student_id: string }) => m.student_id)
    const [profilesRes, badgesRes] = studentIds.length > 0
      ? await Promise.all([
          admin.from('student_profiles')
            .select('student_id, display_name, avatar_emoji, avatar_color, xp, level, streak_days')
            .in('student_id', studentIds),
          admin.from('student_badges')
            .select('student_id, badges(slug, name, emoji)')
            .in('student_id', studentIds),
        ])
      : [{ data: [] }, { data: [] }]

    // Index by student_id for easy lookup
    const profileMap = Object.fromEntries(
      (profilesRes.data ?? []).map((p: { student_id: string }) => [p.student_id, p])
    )
    const badgeMap: Record<string, { slug: string; name: string; emoji: string }[]> = {}
    for (const row of (badgesRes.data ?? [])) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any
      if (!badgeMap[r.student_id]) badgeMap[r.student_id] = []
      if (r.badges) badgeMap[r.student_id].push(r.badges)
    }

    const enrichedMembers = members.map((m: { student_id: string }) => ({
      ...m,
      student_profile: profileMap[m.student_id] ?? null,
      student_badges: badgeMap[m.student_id] ?? [],
    }))

    return NextResponse.json({
      classroom,
      members: enrichedMembers,
      assignments: assignmentsRes.data ?? [],
    })
  } catch (err) {
    console.error('[classroom/classes/[classId] GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}

// PATCH — update class name/grade/subject
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { classId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { name, grade, subject } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ message: 'Class name is required.' }, { status: 400 })
    }
    if (grade !== null && grade !== undefined && (typeof grade !== 'number' || grade < 1 || grade > 12)) {
      return NextResponse.json({ message: 'Grade must be between 1 and 12.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('classrooms')
      .update({
        name: name.trim(),
        grade: grade ?? null,
        subject: subject?.trim() || null,
      })
      .eq('id', classId)
      .eq('educator_id', user.id)
      .select('id, name, grade, subject, join_code, created_at')
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ message: 'Class not found.' }, { status: 404 })

    return NextResponse.json({ classroom: data })
  } catch (err) {
    console.error('[classroom/classes/[classId] PATCH]', err)
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

    const { count } = await admin
      .from('classrooms')
      .select('id', { count: 'exact', head: true })
      .eq('educator_id', user.id)
      .eq('is_active', true)

    const remaining = count ?? 0
    return NextResponse.json({
      success: true,
      remainingActiveClassrooms: remaining,
      redirectTo: remaining > 0 ? '/classroom/educator' : '/classroom',
    })
  } catch (err) {
    console.error('[classroom/classes/[classId] DELETE]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
