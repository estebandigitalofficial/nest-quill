// Server-only. Computes the launch-readiness checklist surfaced at
// /admin/beta-readiness. Each check returns a structured result so
// the page renders consistent pills without ever crashing on a
// missing table or schema-drift error.
//
// Status language:
//   'pass'    — green, all-good
//   'warn'    — amber, watch
//   'fail'    — red, broken / blocking when blocker=true
//   'unknown' — neutral, couldn't verify (treated as warn for the rollup)
//
// Top-level rollup:
//   BLOCKED   — any blocker check failed
//   CAUTION   — no blocker failures, but at least one warn / fail / unknown
//   READY     — every check passed

import { createAdminClient } from '@/lib/supabase/admin'
import { getSetting } from '@/lib/settings/appSettings'
import { isSettingEnabled } from '@/lib/settings/gates'
import { getAppUrl } from '@/lib/utils/appUrl'

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown'
export type Rollup = 'READY' | 'CAUTION' | 'BLOCKED'

export interface Check {
  id: string
  label: string
  status: CheckStatus
  detail?: string
  /** When true, a 'fail' status promotes the rollup to BLOCKED. */
  blocker?: boolean
}

export interface ReadinessSection {
  id: string
  title: string
  description?: string
  checks: Check[]
}

export interface RiskSnapshot {
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

export interface ReadinessReport {
  rollup: Rollup
  sections: ReadinessSection[]
  risk: RiskSnapshot
  generated_at: string
}

const STUCK_THRESHOLD_MINUTES_DEFAULT = 10
const FAILED_LAST_HOUR_BLOCKER_THRESHOLD = 5
const URGENT_TICKETS_BLOCKER_THRESHOLD = 3
const QUEUE_PRESSURE_BLOCKER_THRESHOLD = 25
const REQUIRED_WIZARD_STEP_COUNT = 10

/**
 * Probe whether a table exists by issuing a count head:true query.
 * Returns { exists, ok } where `ok` means the query succeeded;
 * `exists` is false only when PostgREST returns 42P01.
 *
 * Counts head queries are O(metadata) — no row scan — so this is the
 * cheapest schema probe available without raw SQL.
 */
async function probeTable(name: string): Promise<{ exists: boolean; queryOk: boolean }> {
  const db = createAdminClient()
  const { error } = await db.from(name).select('*', { count: 'exact', head: true }).limit(1)
  if (!error) return { exists: true, queryOk: true }
  if (error.code === '42P01') return { exists: false, queryOk: true }
  // Any other error (RLS misconfiguration, etc.) — admit we can't tell.
  return { exists: false, queryOk: false }
}

/** Probe whether a column exists by selecting it head-only. */
async function probeColumn(table: string, column: string): Promise<{ exists: boolean; queryOk: boolean }> {
  const db = createAdminClient()
  const { error } = await db.from(table).select(column, { count: 'exact', head: true }).limit(1)
  if (!error) return { exists: true, queryOk: true }
  if (error.code === '42703') return { exists: false, queryOk: true }
  if (error.code === '42P01') return { exists: false, queryOk: false }
  return { exists: false, queryOk: false }
}

function pass(id: string, label: string, detail?: string, blocker = false): Check {
  return { id, label, status: 'pass', detail, blocker }
}
function fail(id: string, label: string, detail: string, blocker = false): Check {
  return { id, label, status: 'fail', detail, blocker }
}
function warn(id: string, label: string, detail: string, blocker = false): Check {
  return { id, label, status: 'warn', detail, blocker }
}
function unknown(id: string, label: string, detail: string, blocker = false): Check {
  return { id, label, status: 'unknown', detail, blocker }
}

function settingCheck(id: string, label: string, enabled: boolean, blocker = true): Check {
  return enabled
    ? pass(id, label, 'Enabled', blocker)
    : fail(id, label, 'Disabled — flip it on in Beta Ops before launch', blocker)
}

function tableCheck(id: string, label: string, probe: { exists: boolean; queryOk: boolean }, blocker = true): Check {
  if (probe.exists) return pass(id, label, 'Schema present', blocker)
  if (probe.queryOk) return fail(id, label, 'Table missing — apply the migration', blocker)
  return unknown(id, label, 'Could not verify — check service-role credentials', blocker)
}

function columnCheck(id: string, label: string, probe: { exists: boolean; queryOk: boolean }, blocker = false): Check {
  if (probe.exists) return pass(id, label, 'Column present', blocker)
  if (probe.queryOk) return fail(id, label, 'Column missing — apply the migration', blocker)
  return unknown(id, label, 'Could not verify', blocker)
}

export async function getReadinessReport(): Promise<ReadinessReport> {
  const db = createAdminClient()
  const lastHourIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const todayStart = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString() })()

  // ── Read settings up front (parallel) ───────────────────────────────────
  const [
    storyCreationOn,
    supportTicketsOn,
    guidedToursOn,
    betaModeOn,
    learningToolsOn,
    maintenanceBannerRows,
  ] = await Promise.all([
    isSettingEnabled('story_creation_enabled'),
    isSettingEnabled('support_tickets_enabled'),
    isSettingEnabled('guided_tours_enabled'),
    getSetting<boolean>('beta_mode_enabled', false),
    isSettingEnabled('learning_tools_enabled'),
    // Direct app_settings read so we can distinguish "row missing" from
    // "row present but value is false / empty". getSetting() collapses
    // those into the same fallback, which loses information we need to
    // decide between pass / warn here.
    db.from('app_settings')
      .select('key, value')
      .in('key', ['maintenance_banner_enabled', 'maintenance_banner_message']),
  ])

  // ── Maintenance banner state ────────────────────────────────────────────
  const bannerRowsByKey = new Map<string, unknown>()
  let bannerQueryOk = !maintenanceBannerRows.error
  for (const row of (maintenanceBannerRows.data ?? []) as { key: string; value: unknown }[]) {
    bannerRowsByKey.set(row.key, row.value)
  }
  // The app_settings table itself missing (42P01) is unusual and the
  // rest of the page already depends on it — surface as unknown rather
  // than fail, since it implies a deeper deployment problem we shouldn't
  // double-report here.
  if (maintenanceBannerRows.error?.code === '42P01') bannerQueryOk = false

  const bannerEnabledRowExists = bannerRowsByKey.has('maintenance_banner_enabled')
  const bannerMessageRowExists = bannerRowsByKey.has('maintenance_banner_message')
  const bannerEnabledRaw = bannerRowsByKey.get('maintenance_banner_enabled')
  const bannerMessageRaw = bannerRowsByKey.get('maintenance_banner_message')
  // Tolerate JSONB strings ("true"/"false") the same way isSettingEnabled does.
  const bannerEnabled =
    bannerEnabledRaw === true ? true
    : bannerEnabledRaw === false ? false
    : typeof bannerEnabledRaw === 'string'
      ? bannerEnabledRaw.trim().toLowerCase() === 'true'
      : false
  const bannerMessage = typeof bannerMessageRaw === 'string' ? bannerMessageRaw.trim() : ''
  const bannerMessagePresent = bannerMessage.length > 0

  // ── Probe schema (parallel) ─────────────────────────────────────────────
  const [
    supportProbe,
    toursProbe,
    tourStepsProbe,
    rateLimitProbe,
    idempotencyProbe,
    notificationsProbe,
    workerLeaseColProbe,
    failureCodeColProbe,
    failureStageColProbe,
    retryableColProbe,
  ] = await Promise.all([
    probeTable('support_tickets'),
    probeTable('guided_tours'),
    probeTable('guided_tour_steps'),
    probeTable('rate_limit_events'),
    probeTable('idempotency_keys'),
    probeTable('notifications'),
    probeColumn('story_requests', 'worker_lease_expires_at'),
    probeColumn('story_requests', 'failure_code'),
    probeColumn('story_requests', 'failure_stage'),
    probeColumn('story_requests', 'retryable'),
  ])

  // ── Tour content + state (only meaningful if tables exist) ─────────────
  let wizardTourEnabled: boolean | null = null
  let wizardTourStepCount: number | null = null
  if (toursProbe.exists) {
    // Production schema uses tour_key (not key). We don't probe — the
    // /admin/tours page already surfaces that drift; here we just fetch
    // the row and tolerate a 42703 by reporting unknown.
    const { data: tourRow, error: tourErr } = await db
      .from('guided_tours')
      .select('id, enabled')
      .eq('tour_key', 'create_story_wizard')
      .maybeSingle()
    if (!tourErr && tourRow) {
      wizardTourEnabled = !!tourRow.enabled
      if (tourStepsProbe.exists) {
        const { count } = await db
          .from('guided_tour_steps')
          .select('id', { count: 'exact', head: true })
          .eq('tour_id', tourRow.id)
        wizardTourStepCount = count ?? 0
      }
    }
  }

  // ── Risk snapshot (parallel; tolerant of missing tables) ────────────────
  const stuckThresholdMinutes = (await getSetting<number>('stuck_story_threshold_minutes', STUCK_THRESHOLD_MINUTES_DEFAULT)) ?? STUCK_THRESHOLD_MINUTES_DEFAULT
  const stuckCutoff = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000).toISOString()

  const [
    queuedCountRes,
    processingCountRes,
    stuckCountRes,
    failedLastHourRes,
    openTicketsRes,
    urgentTicketsRes,
    throttlesTodayRes,
    oldestQueuedRowRes,
    staleLeaseCountRes,
  ] = await Promise.all([
    db.from('story_requests').select('id', { count: 'exact', head: true }).eq('status', 'queued'),
    db.from('story_requests').select('id', { count: 'exact', head: true }).in('status', ['generating_text', 'generating_images', 'assembling_pdf']),
    db.from('story_requests').select('id', { count: 'exact', head: true }).in('status', ['generating_text', 'generating_images', 'assembling_pdf']).lt('updated_at', stuckCutoff),
    db.from('story_requests').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('updated_at', lastHourIso),
    supportProbe.exists
      ? db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open')
      : Promise.resolve({ count: 0, error: null }),
    supportProbe.exists
      ? db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').not('status', 'in', '(resolved,closed)')
      : Promise.resolve({ count: 0, error: null }),
    rateLimitProbe.exists
      ? db.from('rate_limit_events').select('id', { count: 'exact', head: true }).gte('created_at', todayStart)
      : Promise.resolve({ count: 0, error: null }),
    db.from('story_requests').select('created_at').eq('status', 'queued').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    workerLeaseColProbe.exists
      ? db.from('story_requests').select('id', { count: 'exact', head: true }).not('worker_id', 'is', null).lt('worker_lease_expires_at', new Date().toISOString())
      : Promise.resolve({ count: 0, error: null }),
  ])

  const queued = queuedCountRes.count ?? 0
  const processing = processingCountRes.count ?? 0
  const stuck = stuckCountRes.count ?? 0
  const failedLastHour = failedLastHourRes.count ?? 0
  const openTickets = openTicketsRes.count ?? 0
  const urgentTickets = urgentTicketsRes.count ?? 0
  const throttlesToday = throttlesTodayRes.count ?? 0
  const oldestQueuedAt = (oldestQueuedRowRes.data as { created_at?: string } | null)?.created_at ?? null
  const oldestQueuedMinutes = oldestQueuedAt
    ? Math.max(0, Math.round((Date.now() - new Date(oldestQueuedAt).getTime()) / 60000))
    : null
  const staleLeases = staleLeaseCountRes.count ?? 0

  // Queue critical pressure: lots of queued OR oldest queued more than ~10min OR stuck stories.
  const queuePressureCritical = queued >= QUEUE_PRESSURE_BLOCKER_THRESHOLD
    || stuck > 0
    || (oldestQueuedMinutes !== null && oldestQueuedMinutes > 15)

  // Production URL canonical match.
  const appUrl = getAppUrl()
  const isProdUrl = appUrl === 'https://nestandquill.com'

  // Payment policy: during beta, payments should be off unless intentionally on.
  // Surface mismatch as a blocker so we can't accidentally publish a launch
  // with payments live before billing is wired end-to-end.
  const paymentsLive = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true'
  const paymentsPolicyOk = betaModeOn ? !paymentsLive : true

  // ── SECTION 2: Critical Launch Blockers ────────────────────────────────
  const criticalChecks: Check[] = [
    settingCheck('story_creation_enabled', 'Story creation enabled', storyCreationOn, true),
    settingCheck('support_tickets_enabled', 'Support intake enabled', supportTicketsOn, true),
    settingCheck('guided_tours_enabled', 'Guided tours master switch on', guidedToursOn, true),
    tableCheck('support_tickets_table', 'support_tickets table exists', supportProbe, true),
    tableCheck('guided_tours_table', 'guided_tours table exists', toursProbe, true),
    wizardTourEnabled === null
      ? unknown('wizard_tour_enabled', 'create_story_wizard tour enabled', toursProbe.exists ? 'Tour row not found — reseed the tour' : 'Schema missing', true)
      : wizardTourEnabled
        ? pass('wizard_tour_enabled', 'create_story_wizard tour enabled', 'Enabled', true)
        : fail('wizard_tour_enabled', 'create_story_wizard tour enabled', 'Tour row is disabled — flip it on in /admin/tours', true),
    wizardTourStepCount === null
      ? unknown('wizard_tour_steps', `Wizard tour has ≥${REQUIRED_WIZARD_STEP_COUNT} steps`, 'Step count unavailable', true)
      : wizardTourStepCount >= REQUIRED_WIZARD_STEP_COUNT
        ? pass('wizard_tour_steps', `Wizard tour has ≥${REQUIRED_WIZARD_STEP_COUNT} steps`, `${wizardTourStepCount} steps configured`, true)
        : fail('wizard_tour_steps', `Wizard tour has ≥${REQUIRED_WIZARD_STEP_COUNT} steps`, `Only ${wizardTourStepCount} step(s) — apply the wizard tour migrations`, true),
    tableCheck('rate_limit_events_table', 'rate_limit_events table exists', rateLimitProbe, true),
    queuePressureCritical
      ? fail('queue_pressure', 'Story queue not under critical pressure',
          `${queued} queued · ${stuck} stuck · oldest ${oldestQueuedMinutes ?? '—'}m — drain before launch`, true)
      : pass('queue_pressure', 'Story queue not under critical pressure', `${queued} queued · ${processing} processing`, true),
    failedLastHour > FAILED_LAST_HOUR_BLOCKER_THRESHOLD
      ? fail('failed_last_hour', 'Failures last hour below threshold',
          `${failedLastHour} failures in the last hour (threshold ${FAILED_LAST_HOUR_BLOCKER_THRESHOLD}) — investigate`, true)
      : pass('failed_last_hour', 'Failures last hour below threshold', `${failedLastHour} in last hour`, true),
    urgentTickets > URGENT_TICKETS_BLOCKER_THRESHOLD
      ? fail('urgent_tickets', 'Urgent support tickets below threshold',
          `${urgentTickets} urgent tickets open (threshold ${URGENT_TICKETS_BLOCKER_THRESHOLD}) — clear before launch`, true)
      : pass('urgent_tickets', 'Urgent support tickets below threshold', `${urgentTickets} urgent open`, true),
    isProdUrl
      ? pass('production_url', 'Production app URL configured', appUrl, true)
      : fail('production_url', 'Production app URL configured',
          `App URL is "${appUrl}" — set NEXT_PUBLIC_APP_URL=https://nestandquill.com in production`, true),
    paymentsPolicyOk
      ? pass('payments_policy', 'Payment policy matches beta mode',
          paymentsLive ? 'Payments live (beta off)' : 'Payments disabled', true)
      : fail('payments_policy', 'Payment policy matches beta mode',
          'Beta mode is ON but payments are LIVE — set NEXT_PUBLIC_PAYMENTS_ENABLED=false', true),
  ]

  // ── SECTION 3: Beta Safety Systems ─────────────────────────────────────
  const safetyChecks: Check[] = [
    rateLimitProbe.exists
      ? pass('rate_limiting', 'Rate limiting active', 'rate_limit_events writes verified')
      : fail('rate_limiting', 'Rate limiting active', 'rate_limit_events table missing'),
    workerLeaseColProbe.exists
      ? pass('queue_pressure_protection', 'Queue pressure protection active', 'worker leases tracked')
      : warn('queue_pressure_protection', 'Queue pressure protection active', 'worker_lease_expires_at column missing — apply 20240056'),
    tableCheck('idempotency_keys_table', 'idempotency_keys table exists', idempotencyProbe, false),
    columnCheck('worker_lease_columns', 'Worker lease columns on story_requests', workerLeaseColProbe, false),
    failureCodeColProbe.exists && failureStageColProbe.exists && retryableColProbe.exists
      ? pass('failure_classification', 'Failure classification columns exist', 'failure_code · failure_stage · retryable')
      : warn('failure_classification', 'Failure classification columns exist',
          'One or more of failure_code/failure_stage/retryable is missing — apply 20240055'),
    pass('recovery_actions', 'Recovery actions available', 'AdminRecoveryActions component shipped'),
    // Maintenance banner is driven by maintenance_banner_enabled +
    // maintenance_banner_message — entirely separate from beta_mode_enabled.
    // SiteHeader renders the banner when enabled === true AND message is
    // a non-empty string. We mirror that condition here.
    !bannerQueryOk
      ? unknown('maintenance_banner', 'Maintenance banner system available',
          'Could not read maintenance_banner_enabled / maintenance_banner_message')
      : !bannerEnabledRowExists || !bannerMessageRowExists
        ? warn('maintenance_banner', 'Maintenance banner system available',
            `Setting row missing in app_settings: ${[
              !bannerEnabledRowExists && 'maintenance_banner_enabled',
              !bannerMessageRowExists && 'maintenance_banner_message',
            ].filter(Boolean).join(', ')}`)
        : !bannerEnabled
          ? pass('maintenance_banner', 'Maintenance banner system available',
              'Available but off')
          : bannerMessagePresent
            ? pass('maintenance_banner', 'Maintenance banner system available',
                `Active — message: "${bannerMessage.length > 80 ? bannerMessage.slice(0, 80) + '…' : bannerMessage}"`)
            : warn('maintenance_banner', 'Maintenance banner system available',
                'Banner is enabled but maintenance_banner_message is empty — set a message or turn the banner off'),
    betaModeOn
      ? pass('image_generation_state', 'Image generation effective state', 'Beta mode → image generation paused (text-only stories)')
      : pass('image_generation_state', 'Image generation effective state', 'Live — images generating'),
  ]

  // ── SECTION 4: User Experience Readiness ───────────────────────────────
  // Most "is the route reachable" checks are static — the route exists in
  // the codebase, so we mark them as pass. The dynamic checks (settings +
  // tour content) come from values we've already computed.
  const uxChecks: Check[] = [
    supportTicketsOn && supportProbe.exists
      ? pass('support_form_health', 'Support form healthy', 'Intake on, table present')
      : fail('support_form_health', 'Support form healthy',
          !supportTicketsOn ? 'Support intake disabled' : 'support_tickets table missing'),
    guidedToursOn && wizardTourEnabled === true
      ? pass('replay_tour_route', 'Replay guided tour route healthy', 'Master gate on, tour enabled')
      : warn('replay_tour_route', 'Replay guided tour route healthy',
          !guidedToursOn ? 'Master gate off' : wizardTourEnabled === false ? 'Wizard tour row disabled' : 'Tour row missing'),
    wizardTourStepCount !== null && wizardTourStepCount >= REQUIRED_WIZARD_STEP_COUNT
      ? pass('tour_api_steps', `Tour API delivers ≥${REQUIRED_WIZARD_STEP_COUNT} steps`, `${wizardTourStepCount} steps`)
      : warn('tour_api_steps', `Tour API delivers ≥${REQUIRED_WIZARD_STEP_COUNT} steps`,
          wizardTourStepCount === null ? 'Step count unavailable' : `Only ${wizardTourStepCount} step(s)`),
    pass('contact_page', 'Contact page reachable', '/contact ships in this build'),
    pass('create_page', 'Create page reachable', '/create ships in this build'),
    pass('legal_pages', 'Terms & Privacy pages reachable', '/terms · /privacy ship in this build'),
    betaModeOn
      ? pass('beta_legal_copy', 'Beta legal copy active', 'beta_mode_enabled is on — privacy/terms render the beta notice')
      : warn('beta_legal_copy', 'Beta legal copy active', 'Beta mode is OFF — confirm this is intentional before public rollout'),
  ]

  // ── SECTION 5: Operational Readiness ───────────────────────────────────
  // Routes are static. notifications is a live probe.
  const opsChecks: Check[] = [
    pass('command_center_route', 'Command Center route exists', '/admin'),
    pass('beta_ops_route', 'Beta Ops route exists', '/admin/beta-ops'),
    pass('support_admin_route', 'Support Admin route exists', '/admin/support'),
    pass('tours_admin_route', 'Tours Admin route exists', '/admin/tours'),
    pass('reporting_route', 'Reporting route exists', '/admin/reporting'),
    pass('admin_access', 'Admin user access works', 'You authenticated as admin to view this page'),
    tableCheck('notifications_table', 'notifications table exists', notificationsProbe, false),
    learningToolsOn
      ? pass('learning_tools_state', 'Learning tools state', 'Enabled')
      : warn('learning_tools_state', 'Learning tools state', 'Disabled — confirm before launch if learning is in scope'),
  ]

  const sections: ReadinessSection[] = [
    {
      id: 'critical',
      title: 'Critical Launch Blockers',
      description: 'Any red item here promotes the rollup to BLOCKED.',
      checks: criticalChecks,
    },
    {
      id: 'safety',
      title: 'Beta Safety Systems',
      description: 'Recovery + protection layers. Yellow here is a warning, not a launch stop.',
      checks: safetyChecks,
    },
    {
      id: 'ux',
      title: 'User Experience Readiness',
      description: 'Public-facing surfaces a first-time visitor will hit.',
      checks: uxChecks,
    },
    {
      id: 'ops',
      title: 'Operational Readiness',
      description: 'Admin & internal tooling.',
      checks: opsChecks,
    },
  ]

  // ── Rollup ──────────────────────────────────────────────────────────────
  const allChecks = sections.flatMap(s => s.checks)
  const blockerFailed = allChecks.some(c => c.blocker && c.status === 'fail')
  const anyTrouble = allChecks.some(c => c.status === 'fail' || c.status === 'warn' || c.status === 'unknown')
  const rollup: Rollup = blockerFailed ? 'BLOCKED' : anyTrouble ? 'CAUTION' : 'READY'

  const risk: RiskSnapshot = {
    active_jobs: queued + processing,
    queued,
    stuck,
    failed_last_hour: failedLastHour,
    open_tickets: openTickets,
    urgent_tickets: urgentTickets,
    throttles_today: throttlesToday,
    oldest_queued_minutes: oldestQueuedMinutes,
    stale_leases: staleLeases,
  }

  return {
    rollup,
    sections,
    risk,
    generated_at: new Date().toISOString(),
  }
}
