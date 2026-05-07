import Link from 'next/link'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminRetryButton from '@/components/admin/AdminRetryButton'
import AdminForceRequeueButton from '@/components/admin/AdminForceRequeueButton'
import AdminFilters from '@/components/admin/AdminFilters'
import AdminAlertStrip from '@/components/admin/AdminAlertStrip'
import AdminQuickActions from '@/components/admin/AdminQuickActions'
import GlassCard from '@/components/admin/GlassCard'
import type { StoryRequest } from '@/types/database'
import { formatAZTimeShort, formatAZTimeOnly } from '@/lib/utils/formatTime'
import { getSetting } from '@/lib/settings/appSettings'

const PROCESSING_STATUSES = ['generating_text', 'generating_images', 'assembling_pdf']

const VALID_VIEWS = ['failed-stories', 'recent-stories', 'emails', 'submissions'] as const
type AdminView = typeof VALID_VIEWS[number]

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>
}

export default async function AdminPage({ searchParams }: PageProps) {

  const { q, status, view: viewRaw } = await searchParams
  const view = (VALID_VIEWS as readonly string[]).includes(viewRaw ?? '') ? viewRaw as AdminView : undefined
  const adminSupabase = createAdminClient()

  // ── Stuck stories (processing state, not updated in >N min) ─────────────
  const stuckThresholdMinutes = await getSetting('stuck_story_threshold_minutes', 10)
  const stuckCutoff = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000).toISOString()
  const { data: stuckData } = await adminSupabase
    .from('story_requests')
    .select('id, child_name, story_theme, plan_tier, status, progress_pct, user_email, created_at, updated_at, last_error, worker_id, status_message, processing_started_at')
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

  const { count: queuedCount } = await adminSupabase
    .from('story_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'queued')

  // ── Filtered stories table ────────────────────────────────────────────────
  let query = adminSupabase
    .from('story_requests')
    .select('id, child_name, story_theme, plan_tier, status, progress_pct, user_email, created_at, last_error, geo_city, geo_region, geo_country, archived_at')
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
  const todayStart = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString() })()

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

  // ── Today metrics ─────────────────────────────────────────────────────────
  const [
    { count: storiesToday },
    { count: completedToday },
    { count: failedToday },
    { count: newUsersToday },
    { count: guestSubmissionsToday },
  ] = await Promise.all([
    adminSupabase.from('story_requests').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    adminSupabase.from('story_requests').select('id', { count: 'exact', head: true }).eq('status', 'complete').gte('updated_at', todayStart),
    adminSupabase.from('story_requests').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('updated_at', todayStart),
    adminSupabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    adminSupabase.from('story_requests').select('id', { count: 'exact', head: true }).is('user_id', null).gte('created_at', todayStart),
  ])

  // ── Usage & Limits ─────────────────────────────────────────────────────────
  const [
    { count: usersAtLimitCount },
    { data: guestEmailRows },
  ] = await Promise.all([
    adminSupabase.from('profiles').select('id', { count: 'exact', head: true }).gte('books_generated', 2).eq('is_admin', false),
    adminSupabase.from('story_requests').select('user_email, status').is('user_id', null).not('user_email', 'is', null).limit(2000),
  ])

  const totalGuestEmailCount = new Set(
    (guestEmailRows ?? []).map(r => (r.user_email as string).toLowerCase())
  ).size
  const guestAtLimitCount = new Set(
    (guestEmailRows ?? []).filter(r => r.status !== 'failed').map(r => (r.user_email as string).toLowerCase())
  ).size

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

  // ── Dashboard sentinels (cheap, single-row queries) ──────────────────────
  const [
    { data: oldestQueuedRow },
    { error: sponsorProbeError },
    betaMode,
    { count: openTicketsCount, error: ticketProbeError },
    { count: urgentTicketsCount },
  ] = await Promise.all([
    adminSupabase.from('story_requests').select('created_at').eq('status', 'queued').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    // Probe the sponsors table — head:true with limit:1 is the cheapest way
    // to detect "relation does not exist" without scanning rows.
    adminSupabase.from('sponsors').select('id', { head: true, count: 'exact' }).limit(1),
    getSetting('beta_mode_enabled', false) as Promise<boolean>,
    adminSupabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    adminSupabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').not('status', 'in', '(resolved,closed)'),
  ])
  const oldestQueuedMinutes = oldestQueuedRow?.created_at
    ? Math.max(0, (Date.now() - new Date(oldestQueuedRow.created_at as string).getTime()) / 60000)
    : null
  const sponsorTableMissing = sponsorProbeError?.code === '42P01' // undefined_table
  const supportTableMissing = ticketProbeError?.code === '42P01'
  const openTickets = supportTableMissing ? 0 : (openTicketsCount ?? 0)
  const urgentTickets = supportTableMissing ? 0 : (urgentTicketsCount ?? 0)

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
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Command Center overview panel ───────────────────────── */}
        <header className="rounded-lg border border-adm-border bg-adm-surface px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium text-adm-subtle uppercase tracking-[0.14em]">Overview</p>
              <h1 className="text-lg font-semibold text-adm-text mt-0.5">Command Center</h1>
              <p className="text-sm text-adm-muted mt-1 max-w-xl">
                At-a-glance status for the beta. Alerts, queue health, support, and quick controls are below.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/admin/beta-ops" className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors">
                Beta Ops
              </Link>
              <Link href="/admin/support" className="inline-flex items-center gap-1.5 bg-adm-bg hover:bg-adm-surface border border-adm-border text-adm-text text-xs font-medium px-3 py-1.5 rounded-md transition-colors">
                Support {urgentTickets > 0 && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />}
              </Link>
              <Link href="/admin/reporting" className="inline-flex items-center gap-1.5 bg-adm-bg hover:bg-adm-surface border border-adm-border text-adm-text text-xs font-medium px-3 py-1.5 rounded-md transition-colors">
                Reporting
              </Link>
              <Link href="/admin/settings" className="inline-flex items-center gap-1.5 bg-adm-bg hover:bg-adm-surface border border-adm-border text-adm-text text-xs font-medium px-3 py-1.5 rounded-md transition-colors">
                Settings
              </Link>
            </div>
          </div>
        </header>

        {/* Alerts that need attention — renders nothing when all-clear */}
        <AdminAlertStrip
          stuckCount={stuckStories.length}
          failed24h={failedStories24h ?? 0}
          oldestQueuedMinutes={oldestQueuedMinutes}
          betaMode={betaMode}
          sponsorTableMissing={sponsorTableMissing}
          urgentSupportTickets={urgentTickets}
        />

        {/* System status — glass tiles for the eight things we care about most */}
        <section>
          <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">System status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SystemTile label="Story generation"
              tone={(failedStories24h ?? 0) > 0 ? 'amber' : 'green'}
              value={(failedStories24h ?? 0) > 0 ? `${failedStories24h} failed in 24 h` : 'Healthy'} />
            <SystemTile label="Queue"
              tone={stuckStories.length > 0 ? 'red' : (queuedCount ?? 0) > 0 ? 'amber' : 'green'}
              value={stuckStories.length > 0 ? `${stuckStories.length} stuck` : `${queuedCount ?? 0} queued · ${processingCount ?? 0} active`} />
            <SystemTile label="Support"
              tone={(urgentTickets ?? 0) > 0 ? 'red' : (openTickets > 0 ? 'amber' : 'green')}
              value={supportTableMissing ? 'Schema missing' : `${openTickets} open · ${urgentTickets ?? 0} urgent`} />
            <SystemTile label="Beta mode"
              tone={betaMode ? 'amber' : 'neutral'}
              value={betaMode ? 'On' : 'Off'} />
            <SystemTile label="Images"
              tone={betaMode ? 'amber' : 'green'}
              value={betaMode ? 'Paused (beta)' : 'Generating'} />
            <SystemTile label="Payments"
              tone="neutral"
              value={process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true' ? 'Live' : 'Disabled'} />
            <SystemTile label="Notifications"
              tone="green"
              value="Live" />
            <SystemTile label="Classroom"
              tone="neutral"
              value={`${activeClassroomCount ?? 0} active`} />
          </div>
        </section>

        {/* Quick actions — single-tap shortcuts (the sidebar covers full nav) */}
        <AdminQuickActions />

        {/* Today's metrics */}
        <div>
          <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Today</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard label="Stories" value={storiesToday ?? 0}
              href={view === 'recent-stories' ? clearHref : mkViewHref('recent-stories')}
              active={view === 'recent-stories'} />
            <StatCard label="Completed" value={completedToday ?? 0} color="green" />
            <StatCard label="Failed" value={failedToday ?? 0}
              color={(failedToday ?? 0) > 0 ? 'red' : undefined}
              href={view === 'failed-stories' ? clearHref : mkViewHref('failed-stories')}
              active={view === 'failed-stories'} />
            <StatCard label="New users" value={newUsersToday ?? 0} />
            <StatCard label="Guest submissions" value={guestSubmissionsToday ?? 0} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
            <StatCard label="Open support" value={openTickets} color={openTickets > 0 ? 'amber' : undefined} href="/admin/support?status=open" />
          </div>
        </div>

        {/* System Health */}
        <div id="queue-health">
          <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">System Health</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <StatCard label="Queued" value={queuedCount ?? 0} color={(queuedCount ?? 0) > 0 ? 'amber' : undefined} />
            <StatCard label="Processing" value={processingCount ?? 0} color={(processingCount ?? 0) > 0 ? 'amber' : undefined} />
            <StatCard label="Stuck" value={stuckStories.length} color={stuckStories.length > 0 ? 'red' : undefined} />
            <StatCard
              label="Images"
              value={betaMode ? 0 : 1}
              color={betaMode ? 'amber' : 'green'}
            />
          </div>
          {betaMode && (
            <p className="text-[11px] text-amber-300/80 -mt-1 mb-3">
              Beta mode: image generation is paused (text-only stories).
            </p>
          )}

          {/* Stuck story details — only renders when there are stuck stories */}
          {stuckStories.length > 0 && (
            <div className="bg-adm-surface rounded-2xl border border-red-900/60 overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-adm-border flex items-center justify-between">
                <p className="text-xs font-semibold text-red-300 uppercase tracking-widest">Stuck stories</p>
                <span className="text-[11px] text-adm-subtle">threshold: {stuckThresholdMinutes}m no progress</span>
              </div>
              <ul className="divide-y divide-adm-border">
                {stuckStories.slice(0, 8).map((s) => {
                  const idleMs = Date.now() - new Date(s.updated_at!).getTime()
                  const idleMin = Math.round(idleMs / 60000)
                  const w = (s as unknown as { worker_id: string | null; status_message: string | null }).worker_id
                  const msg = (s as unknown as { status_message: string | null }).status_message
                  return (
                    <li key={s.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-adm-text truncate">{s.child_name}</p>
                        <p className="text-[11px] text-adm-muted">
                          <StatusBadge status={s.status} />
                          <span className="ml-2">idle {idleMin}m</span>
                          {w && <span className="ml-2 font-mono text-adm-subtle">worker {w.slice(0, 8)}…</span>}
                        </p>
                        {msg && <p className="text-[11px] text-adm-subtle mt-1 truncate" title={msg}>{msg}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Link href={`/admin/stories/${s.id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">View →</Link>
                        <AdminForceRequeueButton requestId={s.id} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
            <div className="px-4 py-3 border-b border-adm-border">
              <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest">Recent failures</p>
            </div>
            {(recentFailed ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-adm-subtle text-sm">No recent failures.</p>
            ) : (
              <ul className="divide-y divide-adm-border">
                {(recentFailed as unknown as StoryRequest[]).slice(0, 5).map((story) => (
                  <li key={story.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-adm-text truncate">{story.child_name}</p>
                      <p className="text-xs text-red-400 truncate" title={story.last_error ?? ''}>{story.last_error ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-adm-subtle whitespace-nowrap hidden sm:inline">{formatAZTimeShort(story.updated_at!)}</span>
                      <Link href={`/admin/stories/${story.id}`} className="text-xs text-brand-400 hover:text-brand-300 font-medium">View →</Link>
                      <AdminRetryButton requestId={story.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Usage & Limits */}
        <div>
          <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Usage &amp; Limits</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link href="/admin/users" className="block">
              <div className={`rounded-2xl border px-5 py-4 transition-colors ${(usersAtLimitCount ?? 0) > 0 ? 'bg-red-950/30 border-red-800 hover:border-red-600' : 'bg-adm-surface border-adm-border hover:border-brand-600'}`}>
                <p className="text-xs text-adm-muted mb-1">Users at free limit</p>
                <p className={`text-3xl font-bold ${(usersAtLimitCount ?? 0) > 0 ? 'text-red-400' : 'text-adm-text'}`}>{usersAtLimitCount ?? 0}</p>
                <p className="text-[10px] text-adm-subtle mt-1">view users →</p>
              </div>
            </Link>
            <Link href="/admin/guests" className="block">
              <div className={`rounded-2xl border px-5 py-4 transition-colors ${guestAtLimitCount > 0 ? 'bg-amber-950/30 border-amber-800 hover:border-amber-600' : 'bg-adm-surface border-adm-border hover:border-brand-600'}`}>
                <p className="text-xs text-adm-muted mb-1">Guests at trial limit</p>
                <p className={`text-3xl font-bold ${guestAtLimitCount > 0 ? 'text-amber-400' : 'text-adm-text'}`}>{guestAtLimitCount}</p>
                <p className="text-[10px] text-adm-subtle mt-1">view guests →</p>
              </div>
            </Link>
            <StatCard label="Registered users" value={totalUsers ?? 0} />
            <StatCard label="Guest emails" value={totalGuestEmailCount} />
          </div>
        </div>

        {/* ── View detail panel ── */}
        {view && viewRows && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest">
                {{
                  'failed-stories': 'Failed stories (24h)',
                  'recent-stories': 'Stories created (24h)',
                  'emails':         'Emails sent (24h)',
                  'submissions':    'Assignments completed (24h)',
                }[view]}
                <span className="text-adm-subtle font-normal ml-2">({viewRows.length})</span>
              </h2>
              <Link href={clearHref}
                className="text-xs text-adm-muted hover:text-adm-muted border border-adm-border hover:border-adm-border px-3 py-1.5 rounded-lg transition-colors">
                ✕ Clear
              </Link>
            </div>

            <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
              <div className="overflow-x-auto">

                {/* Failed stories */}
                {view === 'failed-stories' && (() => {
                  type Row = { id: string; child_name: string; user_email: string; last_error: string | null; updated_at: string }
                  const rows = viewRows as Row[]
                  return rows.length === 0
                    ? <p className="px-4 py-6 text-center text-adm-subtle text-sm">No failures in the last 24 h.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Child</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                            <th className="text-left px-4 py-3">Error</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">When</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-adm-border">
                          {rows.map(r => (
                            <tr key={r.id} className="hover:bg-adm-surface/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-adm-text">{r.child_name}</td>
                              <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell">{r.user_email}</td>
                              <td className="px-4 py-3 text-red-400 text-xs max-w-[260px] truncate" title={r.last_error ?? ''}>{r.last_error ?? '—'}</td>
                              <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell whitespace-nowrap">{formatAZTimeShort(r.updated_at)}</td>
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
                    ? <p className="px-4 py-6 text-center text-adm-subtle text-sm">No stories in the last 24 h.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Child</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Email</th>
                            <th className="text-left px-4 py-3">Status</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Created</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-adm-border">
                          {rows.map(r => (
                            <tr key={r.id} className="hover:bg-adm-surface/50 transition-colors">
                              <td className="px-4 py-3 font-medium text-adm-text">{r.child_name}</td>
                              <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell">{r.user_email}</td>
                              <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                              <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell whitespace-nowrap">{formatAZTimeShort(r.created_at)}</td>
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
                    ? <p className="px-4 py-6 text-center text-adm-subtle text-sm">No emails sent in the last 24 h.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Type</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Recipient</th>
                            <th className="text-left px-4 py-3">Status</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Sent</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-adm-border">
                          {rows.map(r => (
                            <tr key={r.id} className="hover:bg-adm-surface/50 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-adm-muted">{r.email_type ?? 'story_ready'}</td>
                              <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell">{r.recipient_email ?? '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.status === 'sent' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell whitespace-nowrap">{formatAZTimeShort(r.created_at)}</td>
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
                    ? <p className="px-4 py-6 text-center text-adm-subtle text-sm">No submissions in the last 24 h.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
                            <th className="text-left px-4 py-3">Assignment</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Student</th>
                            <th className="text-left px-4 py-3">Score</th>
                            <th className="text-left px-4 py-3 hidden sm:table-cell">Completed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-adm-border">
                          {rows.map(r => (
                            <tr key={r.id} className="hover:bg-adm-surface/50 transition-colors">
                              <td className="px-4 py-3 font-mono text-[10px] text-adm-muted">{r.assignment_id.slice(0, 8)}…</td>
                              <td className="px-4 py-3 font-mono text-[10px] text-adm-muted hidden sm:table-cell">{r.student_id.slice(0, 8)}…</td>
                              <td className="px-4 py-3 text-adm-text font-semibold text-sm">
                                {r.score != null && r.total ? `${r.score}/${r.total}` : <span className="text-adm-subtle">—</span>}
                              </td>
                              <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell whitespace-nowrap">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total stories" value={totalCount ?? 0} />
          <StatCard label="Complete" value={completeCount ?? 0} color="green" />
          <StatCard label="Failed" value={failedCount ?? 0} color="red" />
          <StatCard label="Processing" value={processingCount ?? 0} color="amber" />
        </div>


        {/* Classroom + email 2-col grid */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Classroom snapshot */}
          <div>
            <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">
              Classroom (24 h)
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Assignments created" value={assignmentsToday ?? 0} />
              <StatCard label="Submissions" value={submissionsToday ?? 0} />
            </div>
            <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
              {(activeClassList ?? []).length === 0 ? (
                <p className="px-4 py-6 text-center text-adm-subtle text-sm">No active classrooms.</p>
              ) : (
                <ul className="divide-y divide-adm-border">
                  {(activeClassList as unknown as { id: string; name: string; grade: number | null; updated_at: string }[]).map((cls) => (
                    <li key={cls.id} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-adm-text">{cls.name}</p>
                        {cls.grade && <p className="text-xs text-adm-muted">Grade {cls.grade}</p>}
                      </div>
                      <span className="text-xs text-adm-subtle whitespace-nowrap shrink-0">
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
            <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">
              Email activity (24 h)
            </h2>
            <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
              {Object.keys(emailBreakdown).length === 0 ? (
                <p className="px-4 py-6 text-center text-adm-subtle text-sm">No emails sent in the last 24 h.</p>
              ) : (
                <ul className="divide-y divide-adm-border">
                  {Object.entries(emailBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <li key={type} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm font-mono text-adm-muted">{type}</span>
                        <span className="text-sm font-bold text-adm-text tabular-nums">{count}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>

        </div>

        {/* Search + filter */}
        <div>
          <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">
            Submissions
          </h2>
          <div className="space-y-4">
            <Suspense>
              <AdminFilters />
            </Suspense>

            <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
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
                  <tbody className="divide-y divide-adm-border">
                    {rows.map((story) => (
                      <tr key={story.id} className="hover:bg-adm-surface/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-adm-text">{story.child_name}</td>
                        <td className="px-4 py-3 text-adm-muted hidden sm:table-cell max-w-[180px] truncate">
                          {story.story_theme}
                        </td>
                        <td className="px-4 py-3 text-adm-muted hidden md:table-cell">{story.user_email}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-adm-muted font-mono">{story.plan_tier}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={story.status} />
                          {(story as unknown as { archived_at?: string | null }).archived_at && (
                            <span className="ml-2 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 align-middle">
                              Archived
                            </span>
                          )}
                          {story.last_error && (
                            <p className="text-[10px] text-red-400 mt-1 max-w-[160px] truncate" title={story.last_error}>
                              {story.last_error}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-adm-muted text-xs hidden lg:table-cell whitespace-nowrap">
                          {story.geo_city || story.geo_region || story.geo_country
                            ? [story.geo_city, story.geo_region, story.geo_country].filter(Boolean).join(', ')
                            : <span className="text-gray-700">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-adm-muted text-xs hidden sm:table-cell whitespace-nowrap">
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
                        <td colSpan={7} className="px-4 py-8 text-center text-adm-subtle">
                          {q || status ? 'No stories match your filters.' : 'No submissions yet.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length === 100 && (
                <p className="text-xs text-adm-subtle text-center py-3 border-t border-adm-border">
                  Showing first 100 results — use filters to narrow down
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline logs */}
        <div>
          <h2 className="text-sm font-semibold text-adm-muted uppercase tracking-widest mb-4">
            Pipeline logs
          </h2>
          <div className="bg-adm-surface rounded-2xl border border-adm-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-adm-border text-xs text-adm-muted uppercase tracking-wider">
                    <th className="text-left px-4 py-3">Level</th>
                    <th className="text-left px-4 py-3">Stage</th>
                    <th className="text-left px-4 py-3">Message</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Request</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-adm-border">
                  {(logs ?? []).map((log) => (
                    <tr key={log.id} className="hover:bg-adm-surface/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <LogLevelBadge level={log.level} />
                      </td>
                      <td className="px-4 py-2.5 text-adm-muted text-xs">{log.stage}</td>
                      <td className="px-4 py-2.5 text-adm-muted text-xs max-w-xs truncate">{log.message}</td>
                      <td className="px-4 py-2.5 text-adm-subtle text-xs hidden sm:table-cell">
                        <Link href={`/story/${log.request_id}`} className="hover:text-brand-400">
                          {log.request_id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-adm-subtle text-xs hidden sm:table-cell whitespace-nowrap">
                        {formatAZTimeOnly(log.created_at)}
                      </td>
                    </tr>
                  ))}
                  {(!logs || logs.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-adm-subtle">
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
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SystemTile({ label, value, tone }: {
  label: string
  value: string
  tone: 'neutral' | 'green' | 'amber' | 'red'
}) {
  const dot = tone === 'green' ? 'bg-emerald-400' : tone === 'amber' ? 'bg-amber-400' : tone === 'red' ? 'bg-rose-400' : 'bg-adm-text/40'
  return (
    <GlassCard tone={tone === 'neutral' ? 'neutral' : tone} className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`w-2 h-2 rounded-full ${dot}`} />
        <p className="text-[11px] uppercase tracking-widest text-adm-muted">{label}</p>
      </div>
      <p className="text-sm font-semibold text-adm-text mt-1">{value}</p>
    </GlassCard>
  )
}

function StatCard({ label, value, color, href, active }: {
  label: string; value: number; color?: 'green' | 'red' | 'amber'; href?: string; active?: boolean
}) {
  const valueColor = color === 'green' ? 'text-emerald-400' : color === 'red' ? 'text-rose-400' : color === 'amber' ? 'text-amber-400' : 'text-adm-text'
  const card = (
    <div className={`rounded-md border px-5 py-4 transition-colors ${
      active
        ? 'bg-sky-500/10 border-sky-500/40'
        : href
        ? 'bg-adm-surface border-adm-border hover:border-sky-500/50 cursor-pointer'
        : 'bg-adm-surface border-adm-border'
    }`}>
      <p className="text-xs text-adm-muted mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
      {href && <p className="text-[10px] text-adm-subtle mt-1">{active ? 'click to close' : 'click to view'}</p>}
    </div>
  )
  return href ? <Link href={href} className="block">{card}</Link> : card
}

function StatusBadge({ status }: { status: string }) {
  // Subtle dark-tinted pills — Linear/Vercel notification style.
  const styles: Record<string, string> = {
    complete:          'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
    failed:            'bg-rose-500/10 text-rose-300 border border-rose-500/30',
    queued:            'bg-amber-500/10 text-amber-300 border border-amber-500/30',
    generating_text:   'bg-sky-500/10 text-sky-300 border border-sky-500/30',
    generating_images: 'bg-sky-500/10 text-sky-300 border border-sky-500/30',
    assembling_pdf:    'bg-sky-500/10 text-sky-300 border border-sky-500/30',
  }
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${styles[status] ?? 'bg-adm-bg text-adm-muted border border-adm-border'}`}>
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
    <span className={`text-[10px] font-bold uppercase ${styles[level] ?? 'text-adm-muted'}`}>
      {level}
    </span>
  )
}
