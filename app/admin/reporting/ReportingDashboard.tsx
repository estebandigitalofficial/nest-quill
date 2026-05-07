'use client'

import { useState, useEffect } from 'react'
import RevenueChart from './charts/RevenueChart'
import StoryAnalyticsChart from './charts/StoryAnalyticsChart'
import UserAnalyticsChart from './charts/UserAnalyticsChart'

interface ReportingData {
  revenue: { period: string; plan_tier: string; total_revenue_cents: number; story_count: number }[]
  storiesByDay: Record<string, { total: number; complete: number; failed: number }>
  statusCounts: Record<string, number>
  topThemes: [string, number][]
  styleCounts: Record<string, number>
  planCounts: Record<string, number>
  storiesByPlanTier: Record<string, number>
  signupsByDay: Record<string, number>
  totals: { totalUsers: number; paidUsers: number; activeUsers: number; conversionRate: string }
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  single: 'Single Story',
  story_pack: 'Story Pack',
  story_pro: 'Story Pro',
  educator: 'Educator',
}

export default function ReportingDashboard({ initialData }: { initialData: ReportingData }) {
  const [data, setData] = useState<ReportingData>(initialData)
  const [from, setFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 86_400_000)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reporting?from=${from}&to=${to}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only refetch if dates changed from default
    // Initial data is already loaded from server
  }, [])

  return (
    <div className={`space-y-10 ${loading ? 'opacity-60' : ''}`}>
      {/* Date range selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-adm-muted">From:</span>
        <input
          type="date"
          className="bg-adm-surface border border-adm-border rounded-lg px-3 py-2 text-xs text-adm-muted focus:ring-2 focus:ring-brand-500 focus:outline-none"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span className="text-xs text-adm-muted">To:</span>
        <input
          type="date"
          className="bg-adm-surface border border-adm-border rounded-lg px-3 py-2 text-xs text-adm-muted focus:ring-2 focus:ring-brand-500 focus:outline-none"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs font-semibold text-adm-text bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Loading...' : 'Update'}
        </button>
      </div>

      {/* Revenue */}
      <section>
        <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">Revenue</h2>
        <RevenueChart data={data.revenue} />
      </section>

      {/* Story Analytics */}
      <section>
        <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">Story Analytics</h2>
        <StoryAnalyticsChart
          statusCounts={data.statusCounts}
          topThemes={data.topThemes}
          styleCounts={data.styleCounts}
          storiesByDay={data.storiesByDay}
        />
      </section>

      {/* Plan tier demand (story-creation picks) */}
      <section>
        <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">
          Plan tier picked at story creation
        </h2>
        <p className="text-xs text-adm-subtle mb-3">
          What plan users selected when starting a story in the date range. During beta, prices are overridden to free,
          but the selection is still recorded — useful as a leading signal for paid demand before billing is enabled.
        </p>
        <PlanTierBreakdown counts={data.storiesByPlanTier} />
      </section>

      {/* User Analytics */}
      <section>
        <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">User Analytics</h2>
        <UserAnalyticsChart
          signupsByDay={data.signupsByDay}
          planCounts={data.planCounts}
          totals={data.totals}
        />
      </section>
    </div>
  )
}

function PlanTierBreakdown({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, n]) => sum + n, 0)
  if (entries.length === 0) {
    return (
      <div className="bg-adm-surface border border-adm-border rounded-2xl px-4 py-6 text-center text-xs text-adm-subtle">
        No story submissions in the selected range.
      </div>
    )
  }
  return (
    <div className="bg-adm-surface border border-adm-border rounded-2xl divide-y divide-adm-border overflow-hidden">
      {entries.map(([tier, n]) => {
        const pct = total > 0 ? Math.round((n / total) * 1000) / 10 : 0
        const isPaid = tier !== 'free'
        return (
          <div key={tier} className="px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-medium text-adm-text w-32 shrink-0">{PLAN_LABELS[tier] ?? tier}</span>
            <div className="flex-1 h-2 bg-adm-bg/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${isPaid ? 'bg-brand-500' : 'bg-adm-border'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-adm-muted tabular-nums w-12 text-right shrink-0">{pct}%</span>
            <span className="text-sm font-bold text-adm-text tabular-nums w-12 text-right shrink-0">{n}</span>
          </div>
        )
      })}
    </div>
  )
}
