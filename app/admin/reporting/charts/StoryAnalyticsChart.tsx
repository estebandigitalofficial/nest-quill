'use client'

import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line,
  ResponsiveContainer,
} from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  complete: '#22c55e',
  failed: '#ef4444',
  queued: '#6b7280',
  generating_text: '#f59e0b',
  generating_images: '#f59e0b',
  assembling_pdf: '#f59e0b',
}

export default function StoryAnalyticsChart({
  statusCounts,
  topThemes,
  styleCounts,
  storiesByDay,
}: {
  statusCounts: Record<string, number>
  topThemes: [string, number][]
  styleCounts: Record<string, number>
  storiesByDay: Record<string, { total: number; complete: number; failed: number }>
}) {
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
  const themeData = topThemes.map(([name, value]) => ({ name: name.slice(0, 20), value }))
  const styleData = Object.entries(styleCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))

  const completionData = Object.entries(storiesByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date: date.slice(5),
      rate: d.total > 0 ? Math.round((d.complete / d.total) * 100) : 0,
    }))

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Status pie */}
      <div>
        <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">By Status</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
              {statusData.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name.replace(/ /g, '_')] ?? '#6b7280'} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Top themes */}
      <div>
        <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Top Themes</p>
        {themeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={themeData} layout="vertical">
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-adm-subtle text-sm py-8">No data.</p>
        )}
      </div>

      {/* Illustration styles */}
      <div>
        <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">By Style</p>
        {styleData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={styleData}>
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-adm-subtle text-sm py-8">No data.</p>
        )}
      </div>

      {/* Completion rate */}
      <div>
        <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Completion Rate</p>
        {completionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={completionData}>
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} formatter={(v) => [`${v}%`, 'Rate']} />
              <Line type="monotone" dataKey="rate" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-adm-subtle text-sm py-8">No data.</p>
        )}
      </div>
    </div>
  )
}
