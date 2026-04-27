import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { xpToLevel } from '@/lib/utils/xp'

const DAILY_CAP = 2
const BASE_XP = 20

export async function POST(request: NextRequest) {
  try {
    const { sessionId, mode, titlePreview, score, total } = await request.json() as {
      sessionId: string
      mode: string
      titlePreview?: string
      score?: number
      total?: number
    }

    if (!sessionId || !mode) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const admin = createAdminClient()

    // Idempotent insert — ON CONFLICT DO NOTHING
    await admin.from('study_sessions').upsert({
      id: sessionId,
      user_id: user?.id ?? null,
      mode,
      title_preview: titlePreview ?? null,
      completed_at: new Date().toISOString(),
    }, { ignoreDuplicates: true })

    // Check if XP was already awarded for this session
    const { data: existing } = await admin
      .from('study_sessions')
      .select('xp_awarded')
      .eq('id', sessionId)
      .single()

    if (existing?.xp_awarded != null) {
      return NextResponse.json({ xpEarned: existing.xp_awarded })
    }

    if (!user) {
      return NextResponse.json({ xpEarned: null })
    }

    // Check daily cap
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { count: todayCount } = await admin
      .from('xp_log')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', user.id)
      .eq('reason', 'study_helper')
      .gte('created_at', startOfDay.toISOString())

    if ((todayCount ?? 0) >= DAILY_CAP) {
      return NextResponse.json({ xpEarned: 0, capped: true })
    }

    // Calculate XP
    let xpEarned = BASE_XP
    if (score != null && total != null && total > 0) {
      xpEarned += Math.round((score / total) * 10)
    }

    // Get or create student profile
    let { data: profile } = await admin
      .from('student_profiles')
      .select('xp, level, coins')
      .eq('student_id', user.id)
      .single()

    if (!profile) {
      await admin.from('student_profiles').insert({ student_id: user.id })
      profile = { xp: 0, level: 1, coins: 0 }
    }

    const newXP = profile.xp + xpEarned
    const newLevel = xpToLevel(newXP)

    await admin.from('student_profiles').update({
      xp: newXP,
      level: newLevel,
      coins: profile.coins + Math.floor(xpEarned / 10),
      last_active_at: new Date().toISOString(),
    }).eq('student_id', user.id)

    await admin.from('xp_log').insert({
      student_id: user.id,
      amount: xpEarned,
      reason: 'study_helper',
    })

    await admin.from('study_sessions').update({ xp_awarded: xpEarned }).eq('id', sessionId)

    return NextResponse.json({ xpEarned, newXP, newLevel })
  } catch (err) {
    console.error('[study-helper/complete] error:', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
