import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    let { data: profile } = await admin
      .from('student_profiles')
      .select('*')
      .eq('student_id', user.id)
      .maybeSingle()

    // Auto-create with defaults so the dashboard is never gated on profile
    // setup. Avatar/name customization is a separate, optional step.
    if (!profile) {
      const { data: created } = await admin
        .from('student_profiles')
        .insert({ student_id: user.id })
        .select('*')
        .single()
      profile = created
    }

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

// Patch profile fields. Each field is optional so the editor can update name,
// color, or photo independently. avatar_url is set/cleared by the dedicated
// /avatar route.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      display_name?: string
      avatar_color?: string
      avatar_emoji?: string
    }

    const updates: Record<string, unknown> = { student_id: user.id }
    if (typeof body.display_name === 'string') {
      const trimmed = body.display_name.trim()
      if (trimmed.length < 1 || trimmed.length > 30) {
        return NextResponse.json({ message: 'Display name must be 1-30 characters.' }, { status: 400 })
      }
      updates.display_name = trimmed
    }
    if (typeof body.avatar_color === 'string' && body.avatar_color.length <= 24) {
      updates.avatar_color = body.avatar_color
    }
    if (typeof body.avatar_emoji === 'string' && body.avatar_emoji.length <= 8) {
      updates.avatar_emoji = body.avatar_emoji
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('student_profiles')
      .upsert(updates, { onConflict: 'student_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ profile: data })
  } catch (err) {
    console.error('[student/profile POST]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
