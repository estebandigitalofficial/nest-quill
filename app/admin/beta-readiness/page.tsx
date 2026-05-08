// /admin/beta-readiness — single-page launch readiness checklist.
// Answers "are we safe to post this publicly today?" without forcing
// an admin to crawl five different dashboards.
//
// Server component — every check runs through the service-role admin
// client. No mutations, no client JS, no realtime fanout.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminContext } from '@/lib/admin/guard'
import { getReadinessReport, type Check, type CheckStatus, type Rollup } from '@/lib/admin/readiness'

export const dynamic = 'force-dynamic'

export default async function BetaReadinessPage() {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/')

  const report = await getReadinessReport()

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <RollupBanner rollup={report.rollup} generatedAt={report.generated_at} />

      {report.sections.map(section => (
        <section key={section.id} className="bg-adm-surface rounded-lg border border-adm-border overflow-hidden">
          <div className="px-5 py-4 border-b border-adm-border">
            <h2 className="text-sm font-semibold text-adm-text">{section.title}</h2>
            {section.description && (
              <p className="text-xs text-adm-muted mt-1">{section.description}</p>
            )}
          </div>
          <ul className="divide-y divide-adm-border">
            {section.checks.map(check => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>
        </section>
      ))}

      <RiskSnapshotPanel risk={report.risk} />

      <ManualTestingNotes />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function RollupBanner({ rollup, generatedAt }: { rollup: Rollup; generatedAt: string }) {
  const palette = {
    READY:   { bar: 'border-emerald-700/60', dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'READY',   tone: 'Safe to post.' },
    CAUTION: { bar: 'border-amber-700/60',   dot: 'bg-amber-400',   text: 'text-amber-300',   label: 'CAUTION', tone: 'Proceed with care — review the items below.' },
    BLOCKED: { bar: 'border-rose-700/60',    dot: 'bg-rose-400',    text: 'text-rose-300',    label: 'BLOCKED', tone: 'Do not post — at least one critical blocker is failing.' },
  }[rollup]
  return (
    <header className={`rounded-lg border ${palette.bar} bg-adm-surface px-5 py-4`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium text-adm-subtle uppercase tracking-[0.14em]">Beta Readiness</p>
          <h1 className="text-lg font-semibold text-adm-text mt-0.5">Launch Checklist</h1>
          <p className="text-sm text-adm-muted mt-1 max-w-xl">
            One-page answer to: are we safe to post this publicly today?
          </p>
        </div>
        <div className="shrink-0 flex flex-col sm:items-end gap-1.5">
          <div className="inline-flex items-center gap-2 bg-adm-bg border border-adm-border px-3 py-1.5 rounded-md">
            <span aria-hidden className={`w-2 h-2 rounded-full ${palette.dot}`} />
            <span className={`text-xs font-bold tracking-[0.18em] ${palette.text}`}>{palette.label}</span>
          </div>
          <p className="text-[11px] text-adm-subtle">
            {palette.tone}
          </p>
          <p className="text-[10px] font-mono text-adm-subtle">
            checked {new Date(generatedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </header>
  )
}

function CheckRow({ check }: { check: Check }) {
  return (
    <li className="px-5 py-3 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-adm-text">
          {check.label}
          {check.blocker && (
            <span className="ml-2 align-middle text-[9px] font-bold tracking-widest text-adm-subtle uppercase">
              blocker
            </span>
          )}
        </p>
        {check.detail && (
          <p className="text-[11px] text-adm-muted mt-0.5">{check.detail}</p>
        )}
      </div>
      <StatusPill status={check.status} />
    </li>
  )
}

function StatusPill({ status }: { status: CheckStatus }) {
  const styles: Record<CheckStatus, { cls: string; label: string }> = {
    pass:    { cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', label: 'pass' },
    warn:    { cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30',       label: 'warn' },
    fail:    { cls: 'bg-rose-500/10 text-rose-300 border-rose-500/30',          label: 'fail' },
    unknown: { cls: 'bg-adm-bg text-adm-muted border-adm-border',               label: 'unknown' },
  }
  const s = styles[status]
  return (
    <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-widest border px-2 py-0.5 rounded-md ${s.cls}`}>
      {s.label}
    </span>
  )
}

function RiskSnapshotPanel({ risk }: {
  risk: {
    active_jobs: number
    queued: number
    stuck: number
    failed_last_hour: number
    open_tickets: number
    urgent_tickets: number
    throttles_today: number
    oldest_queued_minutes: number | null
    stale_leases: number
  }
}) {
  const tiles: { label: string; value: string; tone: 'neutral' | 'amber' | 'red' }[] = [
    { label: 'Active jobs',       value: String(risk.active_jobs),     tone: risk.active_jobs > 10 ? 'amber' : 'neutral' },
    { label: 'Queued stories',    value: String(risk.queued),          tone: risk.queued > 0 ? 'amber' : 'neutral' },
    { label: 'Stuck stories',     value: String(risk.stuck),           tone: risk.stuck > 0 ? 'red' : 'neutral' },
    { label: 'Failures (1h)',     value: String(risk.failed_last_hour), tone: risk.failed_last_hour > 5 ? 'red' : risk.failed_last_hour > 0 ? 'amber' : 'neutral' },
    { label: 'Open tickets',      value: String(risk.open_tickets),    tone: risk.open_tickets > 0 ? 'amber' : 'neutral' },
    { label: 'Urgent tickets',    value: String(risk.urgent_tickets),  tone: risk.urgent_tickets > 0 ? 'red' : 'neutral' },
    { label: 'Throttles today',   value: String(risk.throttles_today), tone: 'neutral' },
    { label: 'Oldest queued',     value: risk.oldest_queued_minutes === null ? '—' : `${risk.oldest_queued_minutes}m`,
      tone: (risk.oldest_queued_minutes ?? 0) > 15 ? 'red' : (risk.oldest_queued_minutes ?? 0) > 5 ? 'amber' : 'neutral' },
    { label: 'Stale leases',      value: String(risk.stale_leases),    tone: risk.stale_leases > 0 ? 'amber' : 'neutral' },
  ]
  return (
    <section className="bg-adm-surface rounded-lg border border-adm-border overflow-hidden">
      <div className="px-5 py-4 border-b border-adm-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-adm-text">Current Risk Snapshot</h2>
          <p className="text-xs text-adm-muted mt-1">Live counts feeding the rollup above.</p>
        </div>
        <Link href="/admin" className="text-xs text-adm-muted hover:text-adm-text border border-adm-border px-3 py-1 rounded-md transition-colors">
          Open Command Center →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-adm-border">
        {tiles.map(t => (
          <RiskTile key={t.label} {...t} />
        ))}
      </div>
    </section>
  )
}

function RiskTile({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'amber' | 'red' }) {
  const dot = tone === 'red' ? 'bg-rose-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-adm-text/40'
  const num = tone === 'red' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-300' : 'text-adm-text'
  return (
    <div className="bg-adm-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <p className="text-[10px] uppercase tracking-widest text-adm-muted">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${num}`}>{value}</p>
    </div>
  )
}

function ManualTestingNotes() {
  // Static checklist — these are smoke-tests an admin runs manually
  // before posting publicly. Listed here so the checklist for "did
  // we hit the obvious paths?" lives next to the green-light banner.
  const items = [
    { id: 'mobile-tour',           label: 'Walk the guided tour on a real phone (Safari + Chrome)' },
    { id: 'adult-consent',         label: 'Pick the Adult / 18+ audience and complete the consent step in the tour' },
    { id: 'duplicate-submit',      label: 'Hammer the Submit button twice in a row — exactly one story is created' },
    { id: 'worker-heartbeat',      label: 'Watch a story go from queued → processing → complete; worker_heartbeat_at advances' },
    { id: 'recovery-buttons',      label: 'Trigger a forced retry from /admin/stories/<id> and confirm it requeues' },
    { id: 'email-flows',           label: 'Confirm the story-ready email + the contact auto-reply land in inbox (not spam)' },
    { id: 'classroom-flow',        label: 'Educator creates an assignment → student joins, submits, score saved' },
  ]
  return (
    <section className="bg-adm-surface rounded-lg border border-adm-border overflow-hidden">
      <div className="px-5 py-4 border-b border-adm-border">
        <h2 className="text-sm font-semibold text-adm-text">Launch Notes — Manual Testing</h2>
        <p className="text-xs text-adm-muted mt-1">
          The checklist can&apos;t verify these from the database. Run them yourself the morning of the post.
        </p>
      </div>
      <ul className="divide-y divide-adm-border">
        {items.map(item => (
          <li key={item.id} className="px-5 py-3 flex items-center gap-3">
            <span className="w-4 h-4 rounded border border-adm-border shrink-0" aria-hidden />
            <span className="text-sm text-adm-text">{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
