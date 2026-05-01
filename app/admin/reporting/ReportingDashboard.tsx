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
  signupsByDay: Record<string, number>
  totals: { totalUsers: number; paidUsers: number; activeUsers: number; conversionRate: string }
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
        <span className="text-xs text-gray-500">From:</span>
        <input
          type="date"
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <span className="text-xs text-gray-500">To:</span>
        <input
          type="date"
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Loading...' : 'Update'}
        </button>
      </div>

      {/* Revenue */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Revenue</h2>
        <RevenueChart data={data.revenue} />
      </section>

      {/* Story Analytics */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Story Analytics</h2>
        <StoryAnalyticsChart
          statusCounts={data.statusCounts}
          topThemes={data.topThemes}
          styleCounts={data.styleCounts}
          storiesByDay={data.storiesByDay}
        />
      </section>

      {/* User Analytics */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">User Analytics</h2>
        <UserAnalyticsChart
          signupsByDay={data.signupsByDay}
          planCounts={data.planCounts}
          totals={data.totals}
        />
      </section>
    </div>
  )
}
