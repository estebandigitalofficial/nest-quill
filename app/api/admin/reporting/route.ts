import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'

export async function GET(req: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0, 10)

  const fromDate = `${from}T00:00:00Z`
  const toDate = `${to}T23:59:59Z`

  const db = createAdminClient()

  const [
    { data: revenueData },
    { data: storyData },
    { data: statusData },
    { data: themeData },
    { data: styleData },
    { data: usersByPlan },
    { data: signupsByDay },
    { count: totalUsers },
    { count: paidUsers },
    { count: activeUsers },
  ] = await Promise.all([
    // Revenue by period
    db.rpc('admin_revenue_by_period', { from_date: fromDate, to_date: toDate }),

    // Stories by day
    db.from('story_requests')
      .select('created_at, status')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at')
      .limit(5000),

    // Stories by status (all time)
    db.from('story_requests')
      .select('status')
      .limit(10000),

    // Stories by theme (top themes)
    db.from('story_requests')
      .select('story_theme')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .limit(5000),

    // Stories by illustration style
    db.from('story_requests')
      .select('illustration_style')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .limit(5000),

    // Users by plan tier
    db.from('profiles')
      .select('plan_tier')
      .limit(10000),

    // Signups over time
    db.from('profiles')
      .select('created_at')
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at')
      .limit(5000),

    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id', { count: 'exact', head: true }).neq('plan_tier', 'free'),
    db.from('story_requests').select('user_id', { count: 'exact', head: true }).gte('created_at', fromDate),
  ])

  // Aggregate stories by day
  const storiesByDay: Record<string, { total: number; complete: number; failed: number }> = {}
  for (const s of storyData ?? []) {
    const day = s.created_at.slice(0, 10)
    if (!storiesByDay[day]) storiesByDay[day] = { total: 0, complete: 0, failed: 0 }
    storiesByDay[day].total++
    if (s.status === 'complete') storiesByDay[day].complete++
    if (s.status === 'failed') storiesByDay[day].failed++
  }

  // Aggregate status counts
  const statusCounts: Record<string, number> = {}
  for (const s of statusData ?? []) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1
  }

  // Top themes
  const themeCounts: Record<string, number> = {}
  for (const s of themeData ?? []) {
    const theme = (s.story_theme as string).slice(0, 30)
    themeCounts[theme] = (themeCounts[theme] ?? 0) + 1
  }
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // Style counts
  const styleCounts: Record<string, number> = {}
  for (const s of styleData ?? []) {
    styleCounts[s.illustration_style] = (styleCounts[s.illustration_style] ?? 0) + 1
  }

  // Plan tier counts
  const planCounts: Record<string, number> = {}
  for (const u of usersByPlan ?? []) {
    planCounts[u.plan_tier] = (planCounts[u.plan_tier] ?? 0) + 1
  }

  // Signups by day
  const signupsByDayAgg: Record<string, number> = {}
  for (const s of signupsByDay ?? []) {
    const day = s.created_at.slice(0, 10)
    signupsByDayAgg[day] = (signupsByDayAgg[day] ?? 0) + 1
  }

  return NextResponse.json({
    revenue: revenueData ?? [],
    storiesByDay,
    statusCounts,
    topThemes,
    styleCounts,
    planCounts,
    signupsByDay: signupsByDayAgg,
    totals: {
      totalUsers: totalUsers ?? 0,
      paidUsers: paidUsers ?? 0,
      activeUsers: activeUsers ?? 0,
      conversionRate: totalUsers ? ((paidUsers ?? 0) / totalUsers * 100).toFixed(1) : '0',
    },
  })
}
