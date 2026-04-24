import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — student joins a class by join code
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const { joinCode } = await request.json() as { joinCode: string }
    if (!joinCode?.trim()) return NextResponse.json({ message: 'Join code is required.' }, { status: 400 })

    const admin = createAdminClient()

    const { data: classroom, error: clsError } = await admin
      .from('classrooms')
      .select('id, name, grade, subject')
      .eq('join_code', joinCode.trim().toUpperCase())
      .eq('is_active', true)
      .single()

    if (clsError || !classroom) {
      return NextResponse.json({ message: 'Class not found. Check your join code.' }, { status: 404 })
    }

    // Upsert — safe to call again if already joined
    const { error } = await admin
      .from('classroom_members')
      .upsert({ classroom_id: classroom.id, student_id: user.id }, { onConflict: 'classroom_id,student_id' })

    if (error) throw error
    return NextResponse.json({ classroom })
  } catch (err) {
    console.error('[classroom/join POST]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
