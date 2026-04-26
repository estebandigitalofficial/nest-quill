import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import AdminRetryButton from '@/components/admin/AdminRetryButton'
import AdminForceRequeueButton from '@/components/admin/AdminForceRequeueButton'
import AdminFilters from '@/components/admin/AdminFilters'
import type { StoryRequest } from '@/types/database'
import { formatAZTimeShort, formatAZTimeOnly } from '@/lib/utils/formatTime'

const PROCESSING_STATUSES = ['generating_text', 'generating_images', 'assembling_pdf']
const STUCK_THRESHOLD_MINUTES = 10

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>
}

export default async function AdminPage({ searchParams }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const { q, status } = await searchParams
  const adminSupabase = createAdminClient()

  // ── Stuck stories (processing state, not updated in >10 min) ──────────────
  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString()
  const { data: stuckData } = await adminSupabase
    .from('story_requests')
    .select('id, child_name, story_theme, plan_tier, status, progress_pct, user_email, created_at, updated_at, last_error')
    .in('status', PROCESSING_STATUSES)
    .lt('updated_at', stuckCutoff)
    .order('updated_at', { ascending: true })

  const stuckStories = (stuckData ?? []) as unknown as StoryRequest[]

  // ── All-time stats (unfiltered) ───────────────────────────────────────────
  const { count: totalCount } = await adminSupabase
    .from('story_requests')
    .select('id', { count: 'exact', head: true })

  const { count: completeCount } = await adminSupabase
    .from('story_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'complete')

  const { count: failedCount } = await adminSupabase
    .from('story_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')

  const { count: processingCount } = await adminSupabase
    .from('story_requests')
    .select('id', { count: 'exact', head: true })
    .in('status', PROCESSING_STATUSES)

  // ── Filtered stories table ────────────────────────────────────────────────
  let query = adminSupabase
    .from('story_requests')
    .select('id, child_name, story_theme, plan_tier, status, progress_pct, user_email, created_at, last_error, geo_city, geo_region, geo_country')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status) query = query.eq('status', status)
  if (q) query = query.or(`user_email.ilike.%${q}%,child_name.ilike.%${q}%`)

  const { data: stories } = await query
  const rows = (stories ?? []) as unknown as StoryRequest[]

  // ── Pipeline logs ─────────────────────────────────────────────────────────
  const { data: logs } = await adminSupabase
    .from('processing_logs')
    .select('id, request_id, level, stage, message, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  // ── Analytics: 24h overview ───────────────────────────────────────────────
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalUsers },
    { count: stories24h },
    { count: activeClassroomCount },
    { count: assignmentsDone24h },
    { count: failedStories24h },
    { count: emailsSent24h },
    { data: recentFailed },
    { count: assignmentsToday },
    { count: submissionsToday },
    { data: emailTypeLogs },
    { data: activeClassList },
  ] = await Promise.all([
    adminSupabase.from('profiles').select('id', { count: 'exact', head: true }),
    adminSupabase.from('story_requests').select('id', { count: 'exact', head: true }).gte('created_at', cutoff24h),
    adminSupabase.from('classrooms').select('id', { count: 'exact', head: true }).eq('is_active', true),
    adminSupabase.from('assignment_submissions').select('id', { count: 'exact', head: true }).eq('status', 'complete').gte('completed_at', cutoff24h),
    adminSupabase.from('story_requests').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('updated_at', cutoff24h),
    adminSupabase.from('delivery_logs').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', cutoff24h),
    adminSupabase.from('story_requests').select('id, child_name, user_email, last_error, updated_at').eq('status', 'failed').order('updated_at', { ascending: false }).limit(8),
    adminSupabase.from('assignments').select('id', { count: 'exact', head: true }).gte('created_at', cutoff24h),
    adminSupabase.from('assignment_submissions').select('id', { count: 'exact', head: true }).gte('started_at', cutoff24h),
    adminSupabase.from('delivery_logs').select('email_type, status').eq('status', 'sent').gte('created_at', cutoff24h).limit(200),
    adminSupabase.from('classrooms').select('id, name, grade, updated_at').eq('is_active', true).order('updated_at', { ascending: false }).limit(5),
  ])

  const emailBreakdown: Record<string, number> = {}
  for (const log of (emailTypeLogs ?? [])) {
    const key = (log as { email_type: string | null }).email_type ?? 'story_ready'
    emailBreakdown[key] = (emailBreakdown[key] ?? 0) + 1
  }

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
        <div className="flex items-center gap-6">
          <Link href="/admin" className="text-xs font-semibold text-white">
            Stories
          </Link>
          <Link href="/admin/users" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Users
          </Link>
          <Link href="/admin/writer" className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">
            Writer →
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Overview */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Overview</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total users" value={totalUsers ?? 0} />
            <StatCard label="Stories (24h)" value={stories24h ?? 0} />
            <StatCard label="Active classrooms" value={activeClassroomCount ?? 0} />
            <StatCard label="Assignments done (24h)" value={assignmentsDone24h ?? 0} color="green" />
            <StatCard label="Failed stories (24h)" value={failedStories24h ?? 0} color={(failedStories24h ?? 0) > 0 ? 'red' : undefined} />
            <StatCard label="Emails sent (24h)" value={emailsSent24h ?? 0} />
          </div>
        </div>

        {/* All-time pipeline stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard label="Total stories" value={totalCount ?? 0} />
          <StatCard label="Complete" value={completeCount ?? 0} color="green" />
          <StatCard label="Failed" value={failedCount ?? 0} color="red" />
          <StatCard label="Processing" value={processingCount ?? 0} color="amber" />
          <StatCard label="Stuck" value={stuckStories.length} color={stuckStories.length > 0 ? 'red' : undefined} />
        </div>

        {/* Stuck stories alert */}
        {stuckStories.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Stuck stories — processing for over {STUCK_THRESHOLD_MINUTES} min
            </h2>
            <div className="bg-red-950/40 rounded-2xl border border-red-800/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-red-800/40 text-xs text-red-500/70 uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Child</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Stuck for</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-800/30">
                    {stuckStories.map((story) => {
                      const stuckMin = Math.round((Date.now() - new Date(story.updated_at!).getTime()) / 60000)
                      return (
                        <tr key={story.id} className="hover:bg-red-900/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">{story.child_name}</td>
                          <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{story.user_email}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={story.status} />
                          </td>
                          <td className="px-4 py-3 text-red-400 text-xs font-mono">{stuckMin}m</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Link href={`/admin/stories/${story.id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                                View →
                              </Link>
                              <AdminForceRequeueButton requestId={story.id} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Recent failures */}
        {(recentFailed ?? []).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Recent failures
            </h2>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Child</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                      <th className="text-left px-4 py-3">Error</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">When</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(recentFailed as unknown as StoryRequest[]).map((story) => (
                      <tr key={story.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{story.child_name}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{story.user_email}</td>
                        <td className="px-4 py-3">
                          <p className="text-red-400 text-xs max-w-[280px] truncate" title={story.last_error ?? ''}>
                            {story.last_error ?? '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">
                          {formatAZTimeShort(story.updated_at!)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Link href={`/admin/stories/${story.id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">
                              View →
                            </Link>
                            <AdminRetryButton requestId={story.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Classroom + email 2-col grid */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Classroom snapshot */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Classroom (24 h)
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Assignments created" value={assignmentsToday ?? 0} />
              <StatCard label="Submissions" value={submissionsToday ?? 0} />
            </div>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              {(activeClassList ?? []).length === 0 ? (
                <p className="px-4 py-6 text-center text-gray-600 text-sm">No active classrooms.</p>
              ) : (
                <ul className="divide-y divide-gray-800">
                  {(activeClassList as unknown as { id: string; name: string; grade: number | null; updated_at: string }[]).map((cls) => (
                    <li key={cls.id} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">{cls.name}</p>
                        {cls.grade && <p className="text-xs text-gray-500">Grade {cls.grade}</p>}
                      </div>
                      <span className="text-xs text-gray-600 whitespace-nowrap shrink-0">
                        {formatAZTimeShort(cls.updated_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Email activity */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Email activity (24 h)
            </h2>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              {Object.keys(emailBreakdown).length === 0 ? (
                <p className="px-4 py-6 text-center text-gray-600 text-sm">No emails sent in the last 24 h.</p>
              ) : (
                <ul className="divide-y divide-gray-800">
                  {Object.entries(emailBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <li key={type} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm font-mono text-gray-300">{type}</span>
                        <span className="text-sm font-bold text-white tabular-nums">{count}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

        </div>

        {/* Search + filter */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Submissions
          </h2>
          <div className="space-y-4">
            <Suspense>
              <AdminFilters />
            </Suspense>

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
                      <th className="text-left px-4 py-3 hidden lg:table-cell">Location</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Date (AZ)</th>
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
                        <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell whitespace-nowrap">
                          {story.geo_city || story.geo_region || story.geo_country
                            ? [story.geo_city, story.geo_region, story.geo_country].filter(Boolean).join(', ')
                            : <span className="text-gray-700">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">
                          {formatAZTimeShort(story.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/admin/stories/${story.id}`}
                              className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                            >
                              View →
                            </Link>
                            {story.status === 'failed' && (
                              <AdminRetryButton requestId={story.id} />
                            )}
                            {PROCESSING_STATUSES.includes(story.status) && (
                              <AdminForceRequeueButton requestId={story.id} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-600">
                          {q || status ? 'No stories match your filters.' : 'No submissions yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length === 100 && (
                <p className="text-xs text-gray-600 text-center py-3 border-t border-gray-800">
                  Showing first 100 results — use filters to narrow down
                </p>
              )}
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
                        {formatAZTimeOnly(log.created_at)}
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
