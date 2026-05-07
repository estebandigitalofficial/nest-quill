'use client'

// Read-only status display for the Stripe wiring. No secrets are passed in
// — the parent computes env presence server-side and sends only booleans.
// Nothing here can enable payments; this is a checklist + diagnostics view.

import Link from 'next/link'

export interface StripeEnv {
  hasSecretKey: boolean
  hasWebhookSecret: boolean
  hasPublishableKey: boolean
  paymentsEnabledFlag: boolean
  // 'test' if the secret key starts with sk_test_, 'live' if sk_live_, else null.
  detectedMode: 'test' | 'live' | null
}

export interface LastWebhookEvent {
  event_id: string
  type: string
  received_at: string
  processed_at: string | null
  error: string | null
}

const WIRING: { label: string; state: 'not_wired' | 'partial' | 'wired'; note: string }[] = [
  { label: 'Checkout',           state: 'not_wired', note: 'No /api/stripe/checkout route yet.' },
  { label: 'Webhook',            state: 'not_wired', note: 'No /api/stripe/webhook route yet.' },
  { label: 'Customer portal',    state: 'not_wired', note: 'No /api/stripe/portal route yet.' },
  { label: 'Subscription sync',  state: 'not_wired', note: 'profiles.subscription_status / current_period_end columns exist; no writer yet.' },
  { label: 'Reporting revenue',  state: 'partial',   note: 'admin_revenue_by_period RPC is live; waiting for paid_at rows from a webhook.' },
]

const CHECKLIST: { label: string; done: boolean }[] = [
  { label: 'Stripe products & prices created (test mode)', done: false },
  { label: 'Subscription columns on profiles',             done: true  },
  { label: 'lib/stripe/server.ts (SDK + customer helper)', done: true  },
  { label: 'Checkout session route',                       done: false },
  { label: 'Webhook route + signature verification',       done: false },
  { label: 'Customer portal route',                        done: false },
  { label: 'Subscription status sync (webhook → profile)', done: false },
  { label: 'Monthly books_generated reset job',            done: false },
  { label: 'Pricing CTAs route through checkout',          done: false },
  { label: 'Reporting revenue chart populating',           done: false },
]

export default function StripeStatusPanel({ env, betaMode, lastWebhookEvent, webhookLogMissing }: {
  env: StripeEnv
  betaMode: boolean
  lastWebhookEvent: LastWebhookEvent | null
  webhookLogMissing: boolean
}) {
  const modeLabel = env.detectedMode
    ? env.detectedMode === 'test' ? 'Test mode' : 'Live mode'
    : '— (no STRIPE_SECRET_KEY)'
  const stripeDashboard = env.detectedMode === 'live'
    ? 'https://dashboard.stripe.com'
    : 'https://dashboard.stripe.com/test'

  return (
    <div className="space-y-6">
      {/* Top-level status */}
      <div className="bg-amber-500/5 border border-amber-500/30 text-amber-200 rounded-xl px-4 py-3 space-y-1">
        <p className="text-sm font-semibold">Payments are not active yet.</p>
        <p className="text-xs leading-relaxed text-amber-200/80">
          Do not enable payments until checkout, webhook handling, and subscription sync are complete.
          Flipping <code className="text-[11px] bg-amber-500/10 px-1 py-0.5 rounded">NEXT_PUBLIC_PAYMENTS_ENABLED=true</code> today
          would block all paid-tier story submissions with a 402 response.
        </p>
      </div>

      {/* Beta-mode interaction notice */}
      {betaMode && (
        <div className="bg-blue-500/5 border border-blue-500/30 text-blue-200 rounded-xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold">Beta mode is on — pricing is overridden.</p>
          <p className="text-xs leading-relaxed text-blue-200/80">
            Plan cards display as <strong>Free</strong> across the marketing site, and the submit route accepts paid-tier
            selections without invoking Stripe. Users <em>can</em> still pick paid tiers (the picks are recorded in
            <code className="mx-1 text-[11px] bg-blue-500/10 px-1 py-0.5 rounded">story_requests.plan_tier</code>),
            so you can see real demand before launching billing — see <Link href="/admin/reporting" className="underline underline-offset-2 text-blue-100 hover:text-adm-text">Reporting</Link>.
            No charge events are generated.
          </p>
        </div>
      )}

      {/* Status grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatusRow label="Payments enabled" value={env.paymentsEnabledFlag ? 'true' : 'false'} tone={env.paymentsEnabledFlag ? 'warn' : 'ok'} hint="NEXT_PUBLIC_PAYMENTS_ENABLED" />
        <StatusRow label="Stripe mode"      value={modeLabel} tone={env.detectedMode === 'live' ? 'warn' : 'neutral'} hint="Detected from STRIPE_SECRET_KEY prefix" />
        {WIRING.map(w => (
          <StatusRow
            key={w.label}
            label={w.label}
            value={w.state === 'wired' ? 'Wired' : w.state === 'partial' ? 'Partial' : 'Not wired'}
            tone={w.state === 'wired' ? 'ok' : w.state === 'partial' ? 'warn' : 'neutral'}
            hint={w.note}
          />
        ))}
      </div>

      {/* Env presence */}
      <Section title="Environment readiness" subtitle="Presence only — actual secret values are never read by the client.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <EnvRow label="STRIPE_SECRET_KEY"                  present={env.hasSecretKey} />
          <EnvRow label="STRIPE_WEBHOOK_SECRET"              present={env.hasWebhookSecret} />
          <EnvRow label="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" present={env.hasPublishableKey} />
          <EnvRow label="NEXT_PUBLIC_PAYMENTS_ENABLED"       present={env.paymentsEnabledFlag} valueOverride={env.paymentsEnabledFlag ? 'true' : 'false'} neutral />
        </div>
      </Section>

      {/* Last webhook event */}
      <Section title="Webhook health" subtitle="Recorded by /api/stripe/webhook (not built yet) into stripe_webhook_events.">
        {webhookLogMissing ? (
          <div className="bg-red-500/5 border border-red-500/30 rounded-xl px-4 py-3 text-sm">
            <p className="text-red-300 font-medium">Schema not deployed.</p>
            <p className="text-[11px] text-adm-muted mt-1">
              Apply migration <code className="text-[11px] bg-red-500/10 px-1 py-0.5 rounded">20240048_stripe_webhook_events.sql</code>
              in the Supabase SQL editor before wiring the webhook route.
            </p>
          </div>
        ) : lastWebhookEvent ? (
          <div className="bg-adm-bg/50 border border-adm-border rounded-xl px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[11px] text-adm-muted uppercase tracking-widest">Type</p>
              <p className="font-mono text-xs text-adm-text mt-0.5 break-all">{lastWebhookEvent.type}</p>
            </div>
            <div>
              <p className="text-[11px] text-adm-muted uppercase tracking-widest">Received</p>
              <p className="text-xs text-adm-text mt-0.5">{new Date(lastWebhookEvent.received_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] text-adm-muted uppercase tracking-widest">Status</p>
              <p className={`text-xs mt-0.5 font-semibold ${
                lastWebhookEvent.error
                  ? 'text-red-300'
                  : lastWebhookEvent.processed_at
                  ? 'text-green-400'
                  : 'text-amber-300'
              }`}>
                {lastWebhookEvent.error ? 'Errored' : lastWebhookEvent.processed_at ? 'Processed' : 'Pending'}
              </p>
            </div>
            {lastWebhookEvent.error && (
              <p className="sm:col-span-3 text-[11px] text-red-300/80 break-words" title={lastWebhookEvent.error}>
                {lastWebhookEvent.error}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-adm-bg/50 border border-adm-border rounded-xl px-4 py-3 text-xs text-adm-muted">
            No webhook events recorded yet. The log fills in once the webhook handler is wired and Stripe starts delivering events.
          </div>
        )}
      </Section>

      {/* Quick links */}
      <Section title="Quick links" subtitle="Outbound dashboards and docs — no app state changes.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <QuickLink href={stripeDashboard} external>
            Stripe dashboard
            <span className="block text-[10px] text-adm-subtle mt-0.5">{env.detectedMode === 'live' ? 'Live' : 'Test'}</span>
          </QuickLink>
          <QuickLink href="https://stripe.com/docs/webhooks" external>
            Webhook docs
            <span className="block text-[10px] text-adm-subtle mt-0.5">stripe.com/docs</span>
          </QuickLink>
          <QuickLink href="/admin/beta">
            Beta settings
            <span className="block text-[10px] text-adm-subtle mt-0.5">/admin/beta</span>
          </QuickLink>
          <QuickLink href="/admin/reporting">
            Reporting
            <span className="block text-[10px] text-adm-subtle mt-0.5">Plan tier demand</span>
          </QuickLink>
        </div>
      </Section>

      {/* Implementation checklist */}
      <Section title="Implementation checklist" subtitle="Tracking the steps required before payments can be turned on.">
        <ul className="bg-adm-bg/50 border border-adm-border rounded-xl divide-y divide-adm-border">
          {CHECKLIST.map(item => (
            <li key={item.label} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span
                aria-hidden="true"
                className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  item.done
                    ? 'bg-green-500/20 border-green-500/60 text-green-400'
                    : 'bg-adm-bg border-adm-border text-transparent'
                }`}
              >
                {item.done ? '✓' : ''}
              </span>
              <span className={item.done ? 'text-adm-text line-through opacity-60' : 'text-adm-text'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <p className="text-xs font-semibold text-adm-muted uppercase tracking-widest">{title}</p>
        {subtitle && <p className="text-[11px] text-adm-subtle mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function StatusRow({ label, value, tone, hint }: {
  label: string
  value: string
  tone: 'ok' | 'warn' | 'neutral'
  hint?: string
}) {
  const toneClass =
    tone === 'ok'   ? 'bg-green-500/10 text-green-400 border-green-500/30' :
    tone === 'warn' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                      'bg-adm-bg text-adm-muted border-adm-border'
  return (
    <div className="flex items-start justify-between gap-3 bg-adm-bg/50 border border-adm-border rounded-xl px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-adm-text">{label}</p>
        {hint && <p className="text-[11px] text-adm-muted mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded border ${toneClass}`}>
        {value}
      </span>
    </div>
  )
}

function QuickLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  const className = 'rounded-xl bg-adm-bg/50 border border-adm-border hover:border-brand-600 px-3 py-2.5 text-xs font-semibold text-adm-text transition-colors'
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link href={href} className={className}>{children}</Link>
}

function EnvRow({ label, present, valueOverride, neutral }: {
  label: string
  present: boolean
  valueOverride?: string
  neutral?: boolean
}) {
  const display = valueOverride ?? (present ? 'Set' : 'Missing')
  const tone: 'ok' | 'warn' | 'neutral' = neutral
    ? 'neutral'
    : present
      ? 'ok'
      : 'warn'
  const toneClass =
    tone === 'ok'   ? 'bg-green-500/10 text-green-400 border-green-500/30' :
    tone === 'warn' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                      'bg-adm-bg text-adm-muted border-adm-border'
  return (
    <div className="flex items-center justify-between gap-3 bg-adm-bg/50 border border-adm-border rounded-xl px-4 py-2.5">
      <code className="text-[11px] text-adm-text font-mono truncate">{label}</code>
      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded border ${toneClass}`}>
        {display}
      </span>
    </div>
  )
}
