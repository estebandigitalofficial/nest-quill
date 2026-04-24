import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcXP, xpToLevel } from '@/lib/utils/xp'

type RouteContext = { params: Promise<{ assignmentId: string }> }

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

    // Get assignment for tool type
    const { data: assignment } = await admin
      .from('assignments')
      .select('id, tool, classroom_id')
      .eq('id', assignmentId)
      .single()

    if (!assignment) return NextResponse.json({ message: 'Assignment not found.' }, { status: 404 })

    // Upsert submission
    const { data: submission, error: subError } = await admin
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

    if (subError) throw subError

    // ── Gamification ─────────────────────────────────────────
    // Get or create student profile
    let { data: profile } = await admin
      .from('student_profiles')
      .select('xp, level, coins, streak_days, last_active_at')
      .eq('student_id', user.id)
      .single()

    if (!profile) {
      await admin.from('student_profiles').insert({ student_id: user.id })
      profile = { xp: 0, level: 1, coins: 0, streak_days: 0, last_active_at: null }
    }

    // Update streak
    const today = new Date().toDateString()
    const lastActive = profile.last_active_at ? new Date(profile.last_active_at).toDateString() : null
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    let newStreak = profile.streak_days
    if (lastActive !== today) {
      newStreak = lastActive === yesterday ? profile.streak_days + 1 : 1
    }

    // Calculate XP
    const { base, bonus, reasons } = calcXP({ tool: assignment.tool, score, total, streakDays: newStreak })
    const totalXP = base + bonus
    const newXP = profile.xp + totalXP
    const newLevel = xpToLevel(newXP)
    const newCoins = profile.coins + Math.floor(totalXP / 10)
    const leveledUp = newLevel > profile.level

    // Update profile
    await admin.from('student_profiles').update({
      xp: newXP,
      level: newLevel,
      coins: newCoins,
      streak_days: newStreak,
      last_active_at: new Date().toISOString(),
    }).eq('student_id', user.id)

    // Log XP entries
    await admin.from('xp_log').insert(
      reasons.map(reason => ({ student_id: user.id, amount: reason === 'assignment_complete' ? base : bonus, reason, assignment_id: assignmentId }))
    )

    // ── Badge checks ─────────────────────────────────────────
    const newBadges: string[] = []

    // Get already-earned badge slugs
    const { data: earnedRows } = await admin
      .from('student_badges')
      .select('badges(slug)')
      .eq('student_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const earned = new Set((earnedRows ?? []).map((r: any) => r.badges?.slug as string | undefined))

    // Get total completions for this student
    const { count: totalDone } = await admin
      .from('assignment_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', user.id)
      .eq('status', 'complete')

    const checks: { slug: string; condition: boolean }[] = [
      { slug: 'first_quest',   condition: (totalDone ?? 0) === 1 },
      { slug: 'quiz_master',   condition: assignment.tool === 'quiz' && score != null && total != null && score === total },
      { slug: 'high_scorer',   condition: assignment.tool === 'quiz' && score != null && total != null && score / total >= 0.8 },
      { slug: 'streak_3',      condition: newStreak >= 3 },
      { slug: 'streak_7',      condition: newStreak >= 7 },
      { slug: 'ten_quests',    condition: (totalDone ?? 0) >= 10 },
      { slug: 'math_whiz',     condition: assignment.tool === 'math' },
      { slug: 'speed_reader',  condition: assignment.tool === 'reading' },
      { slug: 'wordsmith',     condition: assignment.tool === 'spelling' },
    ]

    for (const check of checks) {
      if (check.condition && !earned.has(check.slug)) {
        const { data: badge } = await admin.from('badges').select('id').eq('slug', check.slug).single()
        if (badge) {
          await admin.from('student_badges').insert({ student_id: user.id, badge_id: badge.id }).then(() => {})
          newBadges.push(check.slug)
        }
      }
    }

    return NextResponse.json({
      submission,
      xpEarned: totalXP,
      newXP,
      newLevel,
      leveledUp,
      newStreak,
      newBadges,
    })
  } catch (err) {
    console.error('[classroom/assignments/submit POST]', err)
    return NextResponse.json({ message: 'Something went wrong.' }, { status: 500 })
  }
}
