import Link from 'next/link'

// Top-of-dashboard banner for issues that need an admin's attention.
// Renders nothing when nothing's wrong. Each block is self-contained so
// they stack cleanly on mobile.

export interface AdminAlertProps {
  stuckCount: number
  failed24h: number
  oldestQueuedMinutes: number | null
  betaMode: boolean
  sponsorTableMissing: boolean
  /** When > 0, surfaces an "urgent support tickets waiting" alert. */
  urgentSupportTickets?: number
  /** Set when getSetting calls returned without a row, suggesting first-run state. */
  missingCriticalSettings?: string[]
}

export default function AdminAlertStrip(props: AdminAlertProps) {
  const blocks: { tone: 'red' | 'amber' | 'blue'; title: string; body: string; cta?: { href: string; label: string } }[] = []

  if (props.stuckCount > 0) {
    blocks.push({
      tone: 'red',
      title: `${props.stuckCount} stuck ${props.stuckCount === 1 ? 'story' : 'stories'}`,
      body: 'Stories in a processing state with no progress past the threshold. Force-requeue or inspect the worker.',
      cta: { href: '#queue-health', label: 'View queue' },
    })
  }
  if (props.failed24h > 0) {
    blocks.push({
      tone: 'red',
      title: `${props.failed24h} failed in last 24h`,
      body: 'Recent failures need attention. Each can be retried after diagnosis.',
      cta: { href: '/admin?view=failed-stories', label: 'See failures' },
    })
  }
  if (props.oldestQueuedMinutes !== null && props.oldestQueuedMinutes >= 5) {
    blocks.push({
      tone: 'amber',
      title: `Oldest queued: ${formatMinutes(props.oldestQueuedMinutes)}`,
      body: 'A queued story has been waiting longer than expected. Pipeline may be slow or paused.',
      cta: { href: '#queue-health', label: 'View queue' },
    })
  }
  if (props.betaMode) {
    blocks.push({
      tone: 'blue',
      title: 'Beta mode active — illustrations paused',
      body: 'DALL·E generation is skipped to control costs during beta. Stories complete with text only.',
      cta: { href: '/admin/beta', label: 'Beta settings' },
    })
  }
  if (props.sponsorTableMissing) {
    blocks.push({
      tone: 'red',
      title: 'Sponsor schema not deployed',
      body: 'The sponsors / sponsor_rewards tables are missing. Run migration 20240044_sponsors.sql in the SQL editor.',
    })
  }
  if ((props.urgentSupportTickets ?? 0) > 0) {
    blocks.push({
      tone: 'red',
      title: `${props.urgentSupportTickets} urgent support ticket${props.urgentSupportTickets === 1 ? '' : 's'}`,
      body: 'Tickets marked urgent are waiting for triage. Review and update status in support.',
      cta: { href: '/admin/support?status=open', label: 'Open support' },
    })
  }
  for (const key of props.missingCriticalSettings ?? []) {
    blocks.push({
      tone: 'amber',
      title: `Setting missing: ${key}`,
      body: 'Falling back to default. Set this in admin settings to make the value explicit.',
      cta: { href: '/admin/settings', label: 'Open settings' },
    })
  }

  if (blocks.length === 0) return null

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {blocks.map((b, i) => (
        <div
          key={i}
          className={`rounded-2xl border-l-4 border border-l-current px-4 py-3 shadow-md shadow-amber-900/5 ${
            b.tone === 'red'
              ? 'bg-rose-50 border-rose-300 border-l-rose-500'
              : b.tone === 'amber'
              ? 'bg-amber-50 border-amber-300 border-l-amber-500'
              : 'bg-sky-50 border-sky-300 border-l-sky-500'
          }`}>
          <div className="flex items-start gap-2">
            <span aria-hidden className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
              b.tone === 'red' ? 'bg-rose-500' : b.tone === 'amber' ? 'bg-amber-500' : 'bg-sky-500'
            }`} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${
                b.tone === 'red' ? 'text-rose-800' : b.tone === 'amber' ? 'text-amber-800' : 'text-sky-800'
              }`}>{b.title}</p>
              <p className="text-xs text-adm-muted mt-0.5 leading-snug">{b.body}</p>
              {b.cta && (
                <Link href={b.cta.href} className={`inline-block mt-1.5 text-xs font-semibold ${
                  b.tone === 'red' ? 'text-rose-700 hover:text-rose-900' : b.tone === 'amber' ? 'text-amber-700 hover:text-amber-900' : 'text-sky-700 hover:text-sky-900'
                }`}>
                  {b.cta.label} →
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}m`
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`
}
