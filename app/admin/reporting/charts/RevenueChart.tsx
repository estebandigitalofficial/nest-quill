'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface RevenueRow {
  period: string
  plan_tier: string
  total_revenue_cents: number
  story_count: number
}

export default function RevenueChart({ data }: { data: RevenueRow[] }) {
  // Group by period
  const byPeriod: Record<string, Record<string, number>> = {}
  let totalRevenue = 0
  for (const row of data) {
    if (!byPeriod[row.period]) byPeriod[row.period] = {}
    byPeriod[row.period][row.plan_tier] = (byPeriod[row.period][row.plan_tier] ?? 0) + row.total_revenue_cents
    totalRevenue += row.total_revenue_cents
  }

  const tiers = [...new Set(data.map(r => r.plan_tier))]
  const chartData = Object.entries(byPeriod)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, tiers]) => ({
      date: date.slice(5), // MM-DD
      ...tiers,
    }))

  const COLORS: Record<string, string> = {
    single: '#3b82f6',
    story_pack: '#8b5cf6',
    story_pro: '#f59e0b',
    educator: '#14b8a6',
    free: '#6b7280',
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-adm-surface border border-adm-border rounded-xl px-5 py-4">
          <p className="text-xs text-adm-muted mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-white">${(totalRevenue / 100).toFixed(2)}</p>
        </div>
        <div className="bg-adm-surface border border-adm-border rounded-xl px-5 py-4">
          <p className="text-xs text-adm-muted mb-1">Transactions</p>
          <p className="text-2xl font-bold text-white">{data.length}</p>
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(v) => [`$${(Number(v) / 100).toFixed(2)}`, '']}
            />
            <Legend />
            {tiers.map((tier) => (
              <Bar key={tier} dataKey={tier} stackId="revenue" fill={COLORS[tier] ?? '#6b7280'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-center text-adm-subtle text-sm py-8">No revenue data for this period.</p>
      )}
    </div>
  )
}
