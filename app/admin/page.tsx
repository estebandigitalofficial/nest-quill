import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import AdminRetryButton from '@/components/admin/AdminRetryButton'
import type { StoryRequest } from '@/types/database'

export default async function AdminPage() {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  // ── Data ───────────────────────────────────────────────────────────────────
  const adminSupabase = createAdminClient()

  const { data: stories } = await adminSupabase
    .from('story_requests')
    .select('id, child_name, story_theme, plan_tier, status, progress_pct, user_email, created_at, last_error')
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: logs } = await adminSupabase
    .from('processing_logs')
    .select('id, request_id, level, stage, message, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  const rows = (stories ?? []) as unknown as StoryRequest[]

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total = rows.length
  const complete = rows.filter(s => s.status === 'complete').length
  const failed = rows.filter(s => s.status === 'failed').length
  const processing = rows.filter(s => !['complete', 'failed', 'queued'].includes(s.status)).length

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <header className="border-b border-gray-800 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-serif text-lg font-semibold text-white">
            Nest &amp; Quill
          </Link>
          <span className="text-xs font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/writer" className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">
            Writer →
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total stories" value={total} />
          <StatCard label="Complete" value={complete} color="green" />
          <StatCard label="Failed" value={failed} color="red" />
          <StatCard label="Processing" value={processing} color="amber" />
        </div>

        {/* Stories table */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Recent submissions
          </h2>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Child</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Theme</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Email</th>
                    <th className="text-left px-4 py-3">Plan</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((story) => (
                    <tr key={story.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{story.child_name}</td>
                      <td className="px-4 py-3 text-gray-400 hidden sm:table-cell max-w-[180px] truncate">
                        {story.story_theme}
                      </td>
                      <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{story.user_email}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400 font-mono">{story.plan_tier}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={story.status} />
                        {story.last_error && (
                          <p className="text-[10px] text-red-400 mt-1 max-w-[160px] truncate" title={story.last_error}>
                            {story.last_error}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">
                        {new Date(story.created_at).toLocaleDateString()}{' '}
                        {new Date(story.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/story/${story.id}`}
                            className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                          >
                            View →
                          </Link>
                          {story.status === 'failed' && (
                            <AdminRetryButton requestId={story.id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-600">
                        No submissions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pipeline logs */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Pipeline logs
          </h2>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Level</th>
                    <th className="text-left px-4 py-3">Stage</th>
                    <th className="text-left px-4 py-3">Message</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Request</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {(logs ?? []).map((log) => (
                    <tr key={log.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <LogLevelBadge level={log.level} />
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{log.stage}</td>
                      <td className="px-4 py-2.5 text-gray-300 text-xs max-w-xs truncate">{log.message}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs hidden sm:table-cell">
                        <Link href={`/story/${log.request_id}`} className="hover:text-brand-400">
                          {log.request_id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs hidden sm:table-cell whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                  {(!logs || logs.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-600">
                        No logs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: 'green' | 'red' | 'amber' }) {
  const valueColor = color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : color === 'amber' ? 'text-amber-400' : 'text-white'
  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: 'bg-green-900 text-green-400',
    failed: 'bg-red-900 text-red-400',
    queued: 'bg-gray-800 text-gray-400',
    generating_text: 'bg-brand-900 text-brand-400',
    generating_images: 'bg-brand-900 text-brand-400',
    assembling_pdf: 'bg-brand-900 text-brand-400',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status] ?? 'bg-gray-800 text-gray-400'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function LogLevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    info: 'text-blue-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
  }
  return (
    <span className={`text-[10px] font-bold uppercase ${styles[level] ?? 'text-gray-400'}`}>
      {level}
    </span>
  )
}
