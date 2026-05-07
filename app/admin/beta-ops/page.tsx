import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/guard'
import { getAllSettings } from '@/lib/settings/appSettings'
import { getQueuePressure, QUEUE_THRESHOLDS } from '@/lib/limits/rateLimits'
import GlassCard from '@/components/admin/GlassCard'
import BetaOpsToggles from './BetaOpsToggles'

const PROCESSING_STATUSES = ['generating_text', 'generating_images', 'assembling_pdf']

const BETA_KEYS = [
  'beta_mode_enabled',
  'story_creation_enabled',
  'guest_story_creation_enabled',
  'learning_tools_enabled',
  'image_generation_enabled',
  'support_tickets_enabled',
  'guided_tours_enabled',
  'maintenance_banner_enabled',
  'maintenance_banner_message',
] as const

const BETA_LABELS: Record<typeof BETA_KEYS[number], string> = {
  beta_mode_enabled: 'Beta mode',
  story_creation_enabled: 'Story creation',
  guest_story_creation_enabled: 'Guest story creation',
  learning_tools_enabled: 'Learning tools',
  image_generation_enabled: 'Image generation',
  support_tickets_enabled: 'Support intake',
  guided_tours_enabled: 'Guided tours',
  maintenance_banner_enabled: 'Maintenance banner',
  maintenance_banner_message: 'Maintenance banner message',
}

export default async function BetaOpsPage() {
  const ctx = await getAdminContext()
  if (!ctx) return null

  const db = createAdminClient()
  const todayStart = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString() })()

  // Pull all settings once and pick the keys we care about.
  const settings = await getAllSettings()
  const settingsMap = new Map(settings.map(s => [s.key, s.value]))
  const betaSettings = BETA_KEYS.map(k => ({
    key: k,
    label: BETA_LABELS[k],
    value: settingsMap.get(k) ?? null,
  }))

  // Soft beta protection metrics. Each is a head:true count and
  // tolerates missing tables (rate_limit_events) gracefully.
  const lastHourIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const queue = await getQueuePressure()
  const [
    { count: throttleStoryToday, error: rateProbeError },
    { count: throttleSupportToday },
    { count: throttleQueueToday },
    { count: storiesLastHour },
  ] = await Promise.all([
    db.from('rate_limit_events').select('id', { count: 'exact', head: true }).eq('action', 'story_submit').gte('created_at', todayStart),
    db.from('rate_limit_events').select('id', { count: 'exact', head: true }).eq('action', 'support_ticket').gte('created_at', todayStart),
    db.from('rate_limit_events').select('id', { count: 'exact', head: true }).in('action', ['queue_warning', 'queue_critical']).gte('created_at', todayStart),
    db.from('story_requests').select('id', { count: 'exact', head: true }).gte('created_at', lastHourIso),
  ])
  const rateLimitTableMissing = rateProbeError?.code === '42P01'

  // Schema-existence probes — graceful for first-run environments.
  // Each fires a head:true count so missing tables surface as 42P01
  // without a row scan.
  const [
    supportProbe, notifProbe, sponsorProbe, webhookProbe, toursProbe,
    { count: signupsToday },
    { count: storiesToday },
    { count: completedToday },
    { count: failedToday },
    { count: ticketsToday },
    { count: urgentTickets },
    { count: queuedCount },
    { count: stuckCount, error: stuckErr },
    { data: storyPlanRows },
    { count: learningToday },
    { count: tourCompleted, error: tourCompletedErr },
    { count: tourSkipped },
  ] = await Promise.all([
    db.from('support_tickets').select('id', { head: true, count: 'exact' }).limit(1),
    db.from('notifications').select('id', { head: true, count: 'exact' }).limit(1),
    db.from('sponsors').select('id', { head: true, count: 'exact' }).limit(1),
    db.from('stripe_webhook_events').select('id', { head: true, count: 'exact' }).limit(1),
    db.from('guided_tours').select('id', { head: true, count: 'exact' }).limit(1),
    db.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    db.from('story_requests').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    db.from('story_requests').select('id', { count: 'exact', head: true }).eq('status', 'complete').gte('updated_at', todayStart),
    db.from('story_requests').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('updated_at', todayStart),
    db.from('support_tickets').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
    db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').not('status', 'in', '(resolved,closed)'),
    db.from('story_requests').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
    db.from('story_requests').select('id', { count: 'exact', head: true }).in('status', PROCESSING_STATUSES).lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()),
    db.from('story_requests').select('plan_tier').gte('created_at', todayStart).limit(1000),
    db.from('story_requests').select('id', { count: 'exact', head: true }).eq('learning_mode', true).gte('created_at', todayStart),
    db.from('user_tour_progress').select('id', { count: 'exact', head: true }).eq('tour_key', 'create_story_wizard').eq('completed', true),
    db.from('user_tour_progress').select('id', { count: 'exact', head: true }).eq('tour_key', 'create_story_wizard').eq('skipped', true),
  ])

  const supportTableMissing  = supportProbe.error?.code === '42P01'
  const notifTableMissing    = notifProbe.error?.code === '42P01'
  const sponsorTableMissing  = sponsorProbe.error?.code === '42P01'
  const webhookTableMissing  = webhookProbe.error?.code === '42P01'
  const toursTableMissing    = toursProbe.error?.code === '42P01'
  const tourProgressMissing  = tourCompletedErr?.code === '42P01'
  const stuckSupported       = !stuckErr || stuckErr.code !== '42P01'

  // Plan tier breakdown today.
  const planTierCounts: Record<string, number> = {}
  for (const r of (storyPlanRows ?? [])) {
    const t = (r as { plan_tier: string }).plan_tier
    planTierCounts[t] = (planTierCounts[t] ?? 0) + 1
  }

  const betaMode = settingsMap.get('beta_mode_enabled') === true
  const imageGenEnabled = settingsMap.get('image_generation_enabled') !== false
  const skipImagesEnv = process.env.SKIP_IMAGE_GENERATION === 'true'
  const imagesPaused = betaMode || !imageGenEnabled || skipImagesEnv
  const imagesActive = !imagesPaused
  const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <header>
        <p className="text-xs font-semibold text-violet-300 uppercase tracking-widest">Beta Ops</p>
        <h1 className="text-2xl font-semibold text-adm-text mt-1">30-day beta control room</h1>
        <p className="text-sm text-adm-muted mt-1.5 max-w-2xl">
          One-glance status for the public beta. Toggles below are wired to <code className="text-[11px] bg-adm-text/5 px-1 py-0.5 rounded">app_settings</code>;
          enforcement is rolled out progressively across the app.
        </p>
      </header>

      {/* ── Current beta state ──────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Current state</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StateTile label="Beta mode"          on={betaMode}                     onTone="amber" offTone="neutral" />
          <StateTile label="Images"             on={imagesActive}                 onTone="green" offTone="amber"   onLabel="Active" offLabel="Paused" />
          <StateTile label="Payments"           on={paymentsEnabled}              onTone="green" offTone="neutral" onLabel="Live"   offLabel="Off"    />
          <StateTile label="Story creation"     on={settingsMap.get('story_creation_enabled')        !== false} />
          <StateTile label="Guest creation"     on={settingsMap.get('guest_story_creation_enabled')  !== false} />
          <StateTile label="Learning tools"     on={settingsMap.get('learning_tools_enabled')        !== false} />
          <StateTile label="Support intake"     on={settingsMap.get('support_tickets_enabled')       !== false} />
          <StateTile label="Guided tours"       on={settingsMap.get('guided_tours_enabled')          !== false} />
        </div>

        {/* Effective image-generation state. The worker uses an AND of
            three signals; surface all three so flipping the right knob
            is unambiguous. */}
        <GlassCard className="mt-3 px-4 py-3" tone={imagesActive ? 'green' : 'amber'}>
          <p className="text-[11px] uppercase tracking-widest text-adm-muted">Image generation — effective state</p>
          <p className="text-sm font-semibold text-adm-text mt-1">{imagesActive ? 'Active' : 'Paused'}</p>
          <p className="text-[11px] text-adm-muted mt-1">
            Active when:&nbsp;
            <Flag on={!betaMode}>beta_mode_enabled = false</Flag>&nbsp;·&nbsp;
            <Flag on={imageGenEnabled}>image_generation_enabled = true</Flag>&nbsp;·&nbsp;
            <Flag on={!skipImagesEnv}>SKIP_IMAGE_GENERATION env unset</Flag>
          </p>
        </GlassCard>
      </section>

      {/* ── Readiness checklist ─────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Beta readiness</h2>
        <GlassCard>
          <ul className="divide-y divide-white/5">
            <Check ok={!supportTableMissing} label="support_tickets table deployed"
                   hint={supportTableMissing ? 'Apply migration 20240050_support_tickets.sql' : 'OK'} />
            <Check ok={!notifTableMissing}    label="notifications table deployed"
                   hint={notifTableMissing ? 'Apply migration 20240049_notifications.sql' : 'OK'} />
            <Check ok={!toursTableMissing}    label="guided_tours table deployed"
                   hint={toursTableMissing ? 'Apply migration 20240051_guided_tours.sql' : 'OK'} />
            <Check ok={!sponsorTableMissing}  label="sponsor tables deployed"
                   hint={sponsorTableMissing ? 'Apply migration 20240044_sponsors.sql' : 'OK'} />
            <Check ok={!webhookTableMissing}  label="stripe_webhook_events table deployed"
                   hint={webhookTableMissing ? 'Apply migration 20240048_stripe_webhook_events.sql' : 'OK'} />
            <Check ok={imagesPaused === betaMode || (betaMode && imagesPaused)}
                   label="Image generation paused while in beta"
                   hint={betaMode && !imagesPaused ? 'Beta is on but image_generation_enabled is true — flip it off below' : 'Aligned'} />
            <Check ok={!paymentsEnabled} label="Payments disabled during beta"
                   hint={paymentsEnabled ? 'NEXT_PUBLIC_PAYMENTS_ENABLED is true — disable in Vercel env before launch' : 'Off'} />
          </ul>
        </GlassCard>
      </section>

      {/* ── Beta protection ─────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Beta protection</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <GlassCard
            tone={queue.level === 'critical' ? 'red' : queue.level === 'warning' ? 'amber' : 'green'}
            className="px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-adm-muted">Queue pressure</p>
            <p className="text-sm font-semibold text-adm-text mt-1">{queue.level}</p>
            <p className="text-[11px] text-adm-subtle mt-1">
              {queue.active} active · warn {QUEUE_THRESHOLDS.warning} · stop {QUEUE_THRESHOLDS.critical}
            </p>
          </GlassCard>
          <MetricTile label="Active jobs" value={queue.active} tone={queue.level === 'critical' ? 'red' : queue.level === 'warning' ? 'amber' : 'neutral'} />
          <MetricTile label="Stories last hour" value={storiesLastHour ?? 0} />
          <MetricTile
            label="Throttles today"
            value={rateLimitTableMissing ? 0 : ((throttleStoryToday ?? 0) + (throttleSupportToday ?? 0) + (throttleQueueToday ?? 0))}
            tone={rateLimitTableMissing ? 'neutral' : 'amber'}
          />
        </div>
        {rateLimitTableMissing ? (
          <p className="mt-2 text-[11px] text-rose-300">
            rate_limit_events table missing — apply migration <code className="text-[11px] bg-adm-text/5 px-1 py-0.5 rounded">20240054_rate_limit_events.sql</code> for throttle metrics.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MetricTile label="Story throttles"   value={throttleStoryToday ?? 0}   tone={(throttleStoryToday ?? 0) > 0 ? 'amber' : 'neutral'} />
            <MetricTile label="Support throttles" value={throttleSupportToday ?? 0} tone={(throttleSupportToday ?? 0) > 0 ? 'amber' : 'neutral'} />
            <MetricTile label="Queue rejects"     value={throttleQueueToday ?? 0}   tone={(throttleQueueToday ?? 0) > 0 ? 'amber' : 'neutral'} />
          </div>
        )}
      </section>

      {/* ── Health metrics ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Today (UTC)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricTile label="Signups"     value={signupsToday ?? 0} />
          <MetricTile label="Stories"     value={storiesToday ?? 0} />
          <MetricTile label="Completed"   value={completedToday ?? 0} tone={(completedToday ?? 0) > 0 ? 'green' : 'neutral'} />
          <MetricTile label="Failed"      value={failedToday ?? 0}    tone={(failedToday ?? 0) > 0 ? 'red' : 'neutral'} />
          <MetricTile label="Tickets"     value={ticketsToday ?? 0} />
          <MetricTile label="Urgent"      value={urgentTickets ?? 0}  tone={(urgentTickets ?? 0) > 0 ? 'red' : 'neutral'} />
          <MetricTile label="Queued"      value={queuedCount ?? 0}    tone={(queuedCount ?? 0) > 0 ? 'amber' : 'neutral'} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <MetricTile label="Stuck stories"  value={stuckSupported ? (stuckCount ?? 0) : 0} tone={(stuckCount ?? 0) > 0 ? 'red' : 'neutral'} />
          <MetricTile label="Learning"       value={learningToday ?? 0} />
          <MetricTile label="Tour completed" value={tourProgressMissing ? 0 : (tourCompleted ?? 0)} tone="violet" />
          <MetricTile label="Tour skipped"   value={tourProgressMissing ? 0 : (tourSkipped ?? 0)} />
        </div>

        {Object.keys(planTierCounts).length > 0 && (
          <GlassCard className="mt-3 px-4 py-3">
            <p className="text-[11px] uppercase tracking-widest text-adm-muted mb-2">Plan tier picked today</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(planTierCounts).sort((a, b) => b[1] - a[1]).map(([tier, n]) => (
                <span key={tier} className="text-xs text-adm-text bg-adm-text/10 border border-adm-text/10 rounded-full px-2.5 py-1">
                  {tier.replace(/_/g, ' ')} <span className="text-adm-subtle ml-1">{n}</span>
                </span>
              ))}
            </div>
          </GlassCard>
        )}
      </section>

      {/* ── Emergency controls ──────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Emergency controls</h2>
        <BetaOpsToggles initial={betaSettings} />
      </section>

      {/* ── Support visibility ──────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Support</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <GlassCard className="px-4 py-4">
            <p className="text-[11px] uppercase tracking-widest text-adm-muted">Open tickets</p>
            <p className="text-3xl font-bold text-adm-text mt-1 tabular-nums">{supportTableMissing ? '—' : (ticketsToday ?? 0)}</p>
            <p className="text-[11px] text-adm-subtle mt-1">opened today</p>
          </GlassCard>
          <GlassCard className="px-4 py-4" tone={(urgentTickets ?? 0) > 0 ? 'red' : 'neutral'}>
            <p className="text-[11px] uppercase tracking-widest text-adm-muted">Urgent waiting</p>
            <p className="text-3xl font-bold text-adm-text mt-1 tabular-nums">{supportTableMissing ? '—' : (urgentTickets ?? 0)}</p>
            <p className="text-[11px] text-adm-subtle mt-1">priority=urgent &amp; not resolved</p>
          </GlassCard>
          <Link href="/admin/support" className="block">
            <GlassCard tone="blue" className="px-4 py-4 h-full hover:border-blue-400/50 transition-colors">
              <p className="text-[11px] uppercase tracking-widest text-blue-200">Open support inbox</p>
              <p className="text-sm text-adm-text mt-1">Triage incoming tickets, set status &amp; priority.</p>
            </GlassCard>
          </Link>
        </div>
      </section>

      {/* ── Onboarding visibility ───────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-adm-muted uppercase tracking-widest mb-3">Onboarding</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <GlassCard className="px-4 py-4">
            <p className="text-[11px] uppercase tracking-widest text-adm-muted">Create-story tour</p>
            <p className="text-sm text-adm-text mt-1">{settingsMap.get('guided_tours_enabled') !== false ? 'Enabled' : 'Disabled'}</p>
            <p className="text-[11px] text-adm-subtle mt-1">
              {tourProgressMissing ? '—' : `${tourCompleted ?? 0} completed · ${tourSkipped ?? 0} skipped`}
            </p>
          </GlassCard>
          <Link href="/admin/tours" className="block">
            <GlassCard className="px-4 py-4 h-full hover:border-adm-text/30 transition-colors">
              <p className="text-[11px] uppercase tracking-widest text-adm-muted">Manage tours</p>
              <p className="text-sm text-adm-text mt-1">Enable/disable, view step config.</p>
            </GlassCard>
          </Link>
          <Link href="/create?replayTour=create_story_wizard" className="block">
            <GlassCard tone="violet" className="px-4 py-4 h-full hover:border-violet-400/50 transition-colors">
              <p className="text-[11px] uppercase tracking-widest text-violet-200">Replay tour</p>
              <p className="text-sm text-adm-text mt-1">Start the create-story tour from step 0.</p>
            </GlassCard>
          </Link>
        </div>
      </section>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function StateTile({
  label, on,
  onTone = 'green', offTone = 'neutral',
  onLabel = 'On', offLabel = 'Off',
}: {
  label: string
  on: boolean
  onTone?: 'green' | 'amber' | 'neutral'
  offTone?: 'green' | 'amber' | 'neutral'
  onLabel?: string
  offLabel?: string
}) {
  const tone = on ? onTone : offTone
  const dot = tone === 'green' ? 'bg-emerald-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-adm-text/40'
  return (
    <GlassCard tone={tone === 'neutral' ? 'neutral' : tone === 'green' ? 'green' : 'amber'} className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`w-2 h-2 rounded-full ${dot}`} />
        <p className="text-xs text-adm-muted">{label}</p>
      </div>
      <p className="text-sm font-semibold text-adm-text mt-1">{on ? onLabel : offLabel}</p>
    </GlassCard>
  )
}

function MetricTile({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'violet' }) {
  const valueColor =
    tone === 'green'  ? 'text-emerald-300' :
    tone === 'amber'  ? 'text-amber-300'   :
    tone === 'red'    ? 'text-rose-300'    :
    tone === 'violet' ? 'text-violet-300'  : 'text-adm-text'
  return (
    <GlassCard tone={tone === 'neutral' ? 'neutral' : tone} className="px-4 py-3">
      <p className="text-[11px] uppercase tracking-widest text-adm-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${valueColor}`}>{value}</p>
    </GlassCard>
  )
}

function Flag({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={on ? 'text-emerald-300' : 'text-rose-300'}>
      {on ? '✓' : '✗'} <span className="font-mono">{children}</span>
    </span>
  )
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <span aria-hidden className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
        ok ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
      }`}>
        {ok ? '✓' : '!'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-adm-text">{label}</p>
        <p className="text-[11px] text-adm-subtle mt-0.5">{hint}</p>
      </div>
    </li>
  )
}
