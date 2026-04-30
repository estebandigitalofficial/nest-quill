import { createAdminClient } from '@/lib/supabase/admin'
import ReportingDashboard from './ReportingDashboard'

export default async function AdminReportingPage() {
  const db = createAdminClient()

  const fromDate = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const toDate = new Date().toISOString()

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
    db.rpc('admin_revenue_by_period', { from_date: fromDate, to_date: toDate }),
    db.from('story_requests').select('created_at, status').gte('created_at', fromDate).lte('created_at', toDate).order('created_at').limit(5000),
    db.from('story_requests').select('status').limit(10000),
    db.from('story_requests').select('story_theme').gte('created_at', fromDate).lte('created_at', toDate).limit(5000),
    db.from('story_requests').select('illustration_style').gte('created_at', fromDate).lte('created_at', toDate).limit(5000),
    db.from('profiles').select('plan_tier').limit(10000),
    db.from('profiles').select('created_at').gte('created_at', fromDate).lte('created_at', toDate).order('created_at').limit(5000),
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('profiles').select('id', { count: 'exact', head: true }).neq('plan_tier', 'free'),
    db.from('story_requests').select('user_id', { count: 'exact', head: true }).gte('created_at', fromDate),
  ])

  // Aggregate
  const storiesByDay: Record<string, { total: number; complete: number; failed: number }> = {}
  for (const s of storyData ?? []) {
    const day = s.created_at.slice(0, 10)
    if (!storiesByDay[day]) storiesByDay[day] = { total: 0, complete: 0, failed: 0 }
    storiesByDay[day].total++
    if (s.status === 'complete') storiesByDay[day].complete++
    if (s.status === 'failed') storiesByDay[day].failed++
  }

  const statusCounts: Record<string, number> = {}
  for (const s of statusData ?? []) {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1
  }

  const themeCounts: Record<string, number> = {}
  for (const s of themeData ?? []) {
    const theme = (s.story_theme as string).slice(0, 30)
    themeCounts[theme] = (themeCounts[theme] ?? 0) + 1
  }
  const topThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10) as [string, number][]

  const styleCounts: Record<string, number> = {}
  for (const s of styleData ?? []) {
    styleCounts[s.illustration_style] = (styleCounts[s.illustration_style] ?? 0) + 1
  }

  const planCounts: Record<string, number> = {}
  for (const u of usersByPlan ?? []) {
    planCounts[u.plan_tier] = (planCounts[u.plan_tier] ?? 0) + 1
  }

  const signupsByDayAgg: Record<string, number> = {}
  for (const s of signupsByDay ?? []) {
    const day = s.created_at.slice(0, 10)
    signupsByDayAgg[day] = (signupsByDayAgg[day] ?? 0) + 1
  }

  const t = totalUsers ?? 0
  const initialData = {
    revenue: (revenueData ?? []) as { period: string; plan_tier: string; total_revenue_cents: number; story_count: number }[],
    storiesByDay,
    statusCounts,
    topThemes,
    styleCounts,
    planCounts,
    signupsByDay: signupsByDayAgg,
    totals: {
      totalUsers: t,
      paidUsers: paidUsers ?? 0,
      activeUsers: activeUsers ?? 0,
      conversionRate: t > 0 ? ((paidUsers ?? 0) / t * 100).toFixed(1) : '0',
    },
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">Reporting</h1>
        <p className="text-sm text-gray-400 mt-1">Revenue, story analytics, and user growth.</p>
      </div>
      <ReportingDashboard initialData={initialData} />
    </div>
  )
}
