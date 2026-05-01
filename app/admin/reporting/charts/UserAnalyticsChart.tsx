'use client'

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, Cell,
  ResponsiveContainer,
} from 'recharts'

const PLAN_COLORS: Record<string, string> = {
  free: '#6b7280',
  single: '#3b82f6',
  story_pack: '#8b5cf6',
  story_pro: '#f59e0b',
  educator: '#14b8a6',
}

export default function UserAnalyticsChart({
  signupsByDay,
  planCounts,
  totals,
}: {
  signupsByDay: Record<string, number>
  planCounts: Record<string, number>
  totals: { totalUsers: number; paidUsers: number; activeUsers: number; conversionRate: string }
}) {
  const signupData = Object.entries(signupsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: date.slice(5), signups: count }))

  const planData = Object.entries(planCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-adm-surface border border-adm-border rounded-xl px-5 py-4">
          <p className="text-xs text-adm-muted mb-1">Total Users</p>
          <p className="text-2xl font-bold text-white">{totals.totalUsers}</p>
        </div>
        <div className="bg-adm-surface border border-adm-border rounded-xl px-5 py-4">
          <p className="text-xs text-adm-muted mb-1">Paid Users</p>
          <p className="text-2xl font-bold text-green-400">{totals.paidUsers}</p>
        </div>
        <div className="bg-adm-surface border border-adm-border rounded-xl px-5 py-4">
          <p className="text-xs text-adm-muted mb-1">Active (period)</p>
          <p className="text-2xl font-bold text-amber-400">{totals.activeUsers}</p>
        </div>
        <div className="bg-adm-surface border border-adm-border rounded-xl px-5 py-4">
          <p className="text-xs text-adm-muted mb-1">Conversion Rate</p>
          <p className="text-2xl font-bold text-brand-400">{totals.conversionRate}%</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Signups over time */}
        <div>
          <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Signups Over Time</p>
          {signupData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={signupData}>
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Line type="monotone" dataKey="signups" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-adm-subtle text-sm py-8">No signup data for this period.</p>
          )}
        </div>

        {/* Users by plan */}
        <div>
          <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Users by Plan</p>
          {planData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={planData}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {planData.map((entry) => {
                    const key = entry.name.replace(/ /g, '_')
                    return <Cell key={key} fill={PLAN_COLORS[key] ?? '#6b7280'} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-adm-subtle text-sm py-8">No data.</p>
          )}
        </div>
      </div>
    </div>
  )
}
