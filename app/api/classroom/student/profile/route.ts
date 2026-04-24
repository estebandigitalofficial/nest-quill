import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('student_profiles')
      .select('*')
      .eq('student_id', user.id)
      .single()

    const { data: badges } = await admin
      .from('student_badges')
      .select('earned_at, badges(slug, name, emoji)')
      .eq('student_id', user.id)
      .order('earned_at', { ascending: false })

    return NextResponse.json({ profile, badges: badges ?? [] })
  } catch (err) {
    console.error('[student/profile GET]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const { display_name, avatar_emoji, avatar_color } = await request.json()

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('student_profiles')
      .upsert({ student_id: user.id, display_name, avatar_emoji, avatar_color }, { onConflict: 'student_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ profile: data })
  } catch (err) {
    console.error('[student/profile POST]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
