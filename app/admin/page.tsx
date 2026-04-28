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

const VALID_VIEWS = ['failed-stories', 'recent-stories', 'emails', 'submissions'] as const
type AdminView = typeof VALID_VIEWS[number]

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>
}

export default async function AdminPage({ searchParams }: PageProps) {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const { q, status, view: viewRaw } = await searchParams
  const view = (VALID_VIEWS as readonly string[]).includes(viewRaw ?? '') ? viewRaw as AdminView : undefined
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

  // ── View-detail query — only runs when a view is active ───────────────────
  const viewQuery =
    view === 'failed-stories'
      ? adminSupabase.from('story_requests').select('id, child_name, user_email, last_error, updated_at').eq('status', 'failed').gte('updated_at', cutoff24h).order('updated_at', { ascending: false }).limit(50)
    : view === 'recent-stories'
      ? adminSupabase.from('story_requests').select('id, child_name, user_email, status, created_at').gte('created_at', cutoff24h).order('created_at', { ascending: false }).limit(50)
    : view === 'emails'
      ? adminSupabase.from('delivery_logs').select('id, email_type, status, recipient_email, created_at, request_id').gte('created_at', cutoff24h).order('created_at', { ascending: false }).limit(50)
    : view === 'submissions'
      ? adminSupabase.from('assignment_submissions').select('id, assignment_id, student_id, status, score, total, completed_at').eq('status', 'complete').gte('completed_at', cutoff24h).order('completed_at', { ascending: false }).limit(50)
    : null

  const { data: viewRows } = viewQuery ? await viewQuery : { data: null }

  // Build href helpers
  function mkViewHref(v: AdminView) {
    const p = new URLSearchParams({ view: v })
    if (q) p.set('q', q)
    if (status) p.set('status', status)
    return `/admin?${p}`
  }
  const clearHref = (() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (status) p.set('status', status)
    return p.toString() ? `/admin?${p}` : '/admin'
  })()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <header className="border-b border-gray-800 px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/admin" className="font-serif text-base sm:text-lg font-semibold text-white">
            Nest &amp; Quill
          </Link>
          <span className="hidden sm:inline-block text-xs font-semibold bg-brand-500 text-white px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/admin" className="text-xs font-semibold text-white">
            Stories
          </Link>
          <Link href="/admin/users" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Users
          </Link>
          <Link href="/admin/guests" className="text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Guests
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
            <StatCard label="Stories (24h)" value={stories24h ?? 0}
              href={view === 'recent-stories' ? clearHref : mkViewHref('recent-stories')}
              active={view === 'recent-stories'} />
            <StatCard label="Active classrooms" value={activeClassroomCount ?? 0} />
            <StatCard label="Assignments done (24h)" value={assignmentsDone24h ?? 0} color="green"
              href={view === 'submissions' ? clearHref : mkViewHref('submissions')}
              active={view === 'submissions'} />
            <StatCard label="Failed stories (24h)" value={failedStories24h ?? 0}
              color={(failedStories24h ?? 0) > 0 ? 'red' : undefined}
              href={view === 'failed-stories' ? clearHref : mkViewHref('failed-stories')}
              active={view === 'failed-stories'} />
            <StatCard label="Emails sent (24h)" value={emailsSent24h ?? 0}
              href={view === 'emails' ? clearHref : mkViewHref('emails')}
              active={view === 'emails'} />
          </div>
        </div>

        {/* ── View detail panel ── */}
        {view && viewRows && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
                {{
                  'failed-stories': 'Failed stories (24h)',
                  'recent-stories': 'Stories created (24h)',
                  'emails':         'Emails sent (24h)',
                  'submissions':    'Assignments completed (24h)',
                }[view]}
                <span className="text-gray-600 font-normal ml-2">({viewRows.length})</span>
              </h2>
              <Link href={clearHref}
                className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors">
                ✕ Clear
              </Link>
            </div>

            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">

                {/* Failed stories */}
                {view === 'failed-stories' && (() => {
                  type Row = { id: string; child_name: string; user_email: string; last_error: string | null; updated_at: string }
                  const rows = viewRows as Row[]
                  return rows.length === 0
                    ? <p className="px-4 py-6 text-center text-gray-600 text-sm">No failures in the last 24 h.</p>
                    : (
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
                          {rows.map(r => (
                            <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-white">{r.child_name}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{r.user_email}</td>
                              <td className="px-4 py-3 text-red-400 text-xs max-w-[260px] truncate" title={r.last_error ?? ''}>{r.last_error ?? '—'}</td>
                              <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">{formatAZTimeShort(r.updated_at)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Link href={`/admin/stories/${r.id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">View →</Link>
                                  <AdminRetryButton requestId={r.id} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                })()}

                {/* Recent stories */}
                {view === 'recent-stories' && (() => {
                  type Row = { id: string; child_name: string; user_email: string; status: string; created_at: string }
                  const rows = viewRows as Row[]
                  return rows.length === 0
                    ? <p className="px-4 py-6 text-center text-gray-600 text-sm">No stories in the last 24 h.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Child</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                            <th className="text-left px-4 py-3">Status</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Created</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {rows.map(r => (
                            <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-white">{r.child_name}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{r.user_email}</td>
                              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                              <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">{formatAZTimeShort(r.created_at)}</td>
                              <td className="px-4 py-3">
                                <Link href={`/admin/stories/${r.id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">View →</Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                })()}

                {/* Emails */}
                {view === 'emails' && (() => {
                  type Row = { id: string; email_type: string | null; status: string; recipient_email: string | null; created_at: string; request_id: string }
                  const rows = viewRows as Row[]
                  return rows.length === 0
                    ? <p className="px-4 py-6 text-center text-gray-600 text-sm">No emails sent in the last 24 h.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Type</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Recipient</th>
                            <th className="text-left px-4 py-3">Status</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Sent</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {rows.map(r => (
                            <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-gray-300">{r.email_type ?? 'story_ready'}</td>
                              <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{r.recipient_email ?? '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.status === 'sent' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">{formatAZTimeShort(r.created_at)}</td>
                              <td className="px-4 py-3">
                                <Link href={`/admin/stories/${r.request_id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">Story →</Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                })()}

                {/* Submissions */}
                {view === 'submissions' && (() => {
                  type Row = { id: string; assignment_id: string; student_id: string; status: string; score: number | null; total: number | null; completed_at: string | null }
                  const rows = viewRows as Row[]
                  return rows.length === 0
                    ? <p className="px-4 py-6 text-center text-gray-600 text-sm">No submissions in the last 24 h.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Assignment</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Student</th>
                            <th className="text-left px-4 py-3">Score</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Completed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {rows.map(r => (
                            <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                              <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{r.assignment_id.slice(0, 8)}…</td>
                              <td className="px-4 py-3 font-mono text-[10px] text-gray-400 hidden sm:table-cell">{r.student_id.slice(0, 8)}…</td>
                              <td className="px-4 py-3 text-white font-semibold text-sm">
                                {r.score != null && r.total ? `${r.score}/${r.total}` : <span className="text-gray-600">—</span>}
                              </td>
                              <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell whitespace-nowrap">
                                {r.completed_at ? formatAZTimeShort(r.completed_at) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                })()}

              </div>
            </div>
          </div>
        )}

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

function StatCard({ label, value, color, href, active }: {
  label: string; value: number; color?: 'green' | 'red' | 'amber'; href?: string; active?: boolean
}) {
  const valueColor = color === 'green' ? 'text-green-400' : color === 'red' ? 'text-red-400' : color === 'amber' ? 'text-amber-400' : 'text-white'
  const card = (
    <div className={`rounded-2xl border px-5 py-4 transition-colors ${
      active
        ? 'bg-brand-950/40 border-brand-600'
        : href
        ? 'bg-gray-900 border-gray-700 hover:border-brand-600 cursor-pointer'
        : 'bg-gray-900 border-gray-800'
    }`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
      {href && <p className="text-[10px] text-gray-600 mt-1">{active ? 'click to close' : 'click to view'}</p>}
    </div>
  )
  return href ? <Link href={href} className="block">{card}</Link> : card
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
