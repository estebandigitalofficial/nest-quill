/**
 * STRIPE WEBHOOK — event handling over an abstract store.
 *
 * Pure except for the store and Stripe-fetch calls, so every rule is
 * testable with the in-memory store in webhook.test.ts. The Supabase store
 * (supabaseBillingStore.ts) maps each method onto one statement.
 *
 * DATA BOUNDARY: this is the ONLY writer of Stripe-sourced entitlements
 * (story_purchases with source='stripe', subscription_periods with
 * source='stripe') and of the Stripe mirror columns on profiles. Checkout
 * success redirects never grant anything; the browser is never trusted.
 *
 * Idempotency, in two layers:
 *   1. stripe_webhook_events.event_id is UNIQUE. An event already marked
 *      processed is acknowledged without running again.
 *   2. Every write is itself idempotent (unique checkout session id on
 *      story_purchases, unique (stripe_subscription_id, period_start) on
 *      subscription_periods, profile sync is an overwrite), so a retry of a
 *      half-processed event, or two deliveries racing, cannot double-grant.
 *
 * When allowance is granted:
 *   - one-time book    checkout.session.completed with payment_status=paid,
 *                      or checkout.session.async_payment_succeeded
 *   - subscriptions    invoice.paid (every billing period, including the
 *                      first) and checkout.session.completed (first period,
 *                      so the buyer is not waiting on event ordering)
 *   customer.subscription.updated never CREATES a period: at renewal Stripe
 *   advances the period before the invoice is paid. It only syncs status and
 *   re-tiers an existing period when the customer changes plan mid-period.
 *
 * What is never taken away: a paid period stays usable until period_end
 * even if the subscription is canceled or a later invoice fails. Refunds are
 * handled by support (not automated here).
 */

import { periodAllowanceFor, type PaidTier } from '../entitlements/policy.ts'
import { isLiveSubscriptionStatus, tierForPriceId } from './config.ts'

type Env = Record<string, string | undefined>

// ── Shapes (structural subsets of Stripe objects; no SDK import) ────────────

export interface StripeEventLike {
  id: string
  type: string
  livemode: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: { object: any }
}

export interface SubscriptionSnapshot {
  id: string
  customerId: string | null
  status: string
  priceId: string | null
  /** Unix seconds. */
  periodStart: number
  periodEnd: number
  cancelAt: number | null
  cancelAtPeriodEnd: boolean
  interval: string | null
  metadataUserId: string | null
  metadataTier: string | null
}

export interface PeriodRow {
  id: string
  planTier: PaidTier
  allowance: number
  used: number
  periodEnd: string
}

export interface ProfileSubscriptionState {
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null
}

export interface ProfileSubscriptionSync {
  stripe_customer_id: string | null
  stripe_subscription_id: string
  subscription_status: string
  stripe_price_id: string | null
  current_period_start: string
  current_period_end: string
  cancel_at: string | null
  billing_interval: string | null
  plan_tier: PaidTier | 'free'
}

export type BeginResult = 'new' | 'retry' | 'done'

export interface BillingStore {
  beginEvent(e: { id: string; type: string; livemode: boolean; payload: unknown }): Promise<BeginResult>
  finishEvent(id: string, error: string | null): Promise<void>

  /** Resolve the Supabase user: explicit id first (must exist), then by customer id. */
  resolveUserId(hint: { userId: string | null; customerId: string | null }): Promise<string | null>
  /** Set profiles.stripe_customer_id when it is empty. Never overwrites a different id. */
  linkCustomer(userId: string, customerId: string): Promise<void>

  insertPurchase(p: {
    userId: string
    tier: PaidTier
    checkoutSessionId: string
    paymentIntentId: string | null
    amountCents: number | null
    currency: string
  }): Promise<'inserted' | 'exists'>

  getProfileSubscription(userId: string): Promise<ProfileSubscriptionState | null>
  updateProfileSubscription(userId: string, fields: ProfileSubscriptionSync): Promise<void>

  getPeriod(subscriptionId: string, periodStartIso: string): Promise<PeriodRow | null>
  insertPeriod(p: {
    userId: string
    subscriptionId: string
    tier: PaidTier
    periodStartIso: string
    periodEndIso: string
    allowance: number
  }): Promise<'inserted' | 'exists'>
  updatePeriod(id: string, fields: { planTier: PaidTier; allowance: number; periodEndIso: string }): Promise<void>
}

export interface WebhookDeps {
  store: BillingStore
  fetchSubscription(id: string): Promise<SubscriptionSnapshot>
  env?: Env
}

export interface HandleResult {
  action: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString()

function idOf(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') return (v as { id: string }).id
  return null
}

/**
 * Normalise a raw Stripe Subscription. Reads the billing period from the
 * subscription (API ≤ 2025-02) or from its first item (API ≥ 2025-03, where
 * Stripe moved current_period_* onto items), so an SDK upgrade does not
 * silently break period granting.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snapshotSubscription(raw: any): SubscriptionSnapshot {
  const item = raw?.items?.data?.[0] ?? null
  const periodStart = Number(raw?.current_period_start ?? item?.current_period_start)
  const periodEnd = Number(raw?.current_period_end ?? item?.current_period_end)
  if (!Number.isFinite(periodStart) || !Number.isFinite(periodEnd)) {
    throw new Error(`subscription ${raw?.id} has no current period`)
  }
  return {
    id: String(raw.id),
    customerId: idOf(raw.customer),
    status: String(raw.status),
    priceId: idOf(item?.price),
    periodStart,
    periodEnd,
    cancelAt: typeof raw.cancel_at === 'number' ? raw.cancel_at : null,
    cancelAtPeriodEnd: raw.cancel_at_period_end === true,
    interval: item?.price?.recurring?.interval ?? null,
    metadataUserId: raw.metadata?.supabase_user_id ?? null,
    metadataTier: raw.metadata?.tier ?? null,
  }
}

function subscriptionTier(sub: SubscriptionSnapshot, env: Env | undefined): PaidTier {
  const byPrice = tierForPriceId(sub.priceId, env)
  if (byPrice === 'story_pack' || byPrice === 'story_pro') return byPrice
  // Fallback to the tier our checkout route stamped on the subscription.
  if (sub.metadataTier === 'story_pack' || sub.metadataTier === 'story_pro') return sub.metadataTier
  throw new Error(`subscription ${sub.id}: price ${sub.priceId ?? '(none)'} does not map to a plan; check STRIPE_PRICE_* env vars`)
}

/** Invoice → subscription id across API versions (top-level, then parent). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function invoiceSubscriptionId(invoice: any): string | null {
  return idOf(invoice?.subscription) ?? idOf(invoice?.parent?.subscription_details?.subscription)
}

// ── Subscription sync + period grant ─────────────────────────────────────────

async function syncSubscription(
  deps: WebhookDeps,
  sub: SubscriptionSnapshot,
  opts: { userIdHint: string | null; grantPeriod: boolean },
): Promise<string> {
  const { store } = deps
  const userId = await store.resolveUserId({ userId: opts.userIdHint ?? sub.metadataUserId, customerId: sub.customerId })
  if (!userId) throw new Error(`subscription ${sub.id}: no Supabase user for customer ${sub.customerId ?? '(none)'}`)
  if (sub.customerId) await store.linkCustomer(userId, sub.customerId)

  const tier = subscriptionTier(sub, deps.env)
  const live = isLiveSubscriptionStatus(sub.status)
  const parts: string[] = []

  // Profile mirror. A stale event for an OLD subscription must not clobber a
  // newer live one: only write when the profile has no subscription, already
  // points at this one, or this one is live (it supersedes a dead one).
  const current = await store.getProfileSubscription(userId)
  const owns = !current?.stripeSubscriptionId || current.stripeSubscriptionId === sub.id
  if (owns || live) {
    await store.updateProfileSubscription(userId, {
      stripe_customer_id: sub.customerId,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      stripe_price_id: sub.priceId,
      current_period_start: iso(sub.periodStart),
      current_period_end: iso(sub.periodEnd),
      cancel_at: sub.cancelAt !== null ? iso(sub.cancelAt) : sub.cancelAtPeriodEnd ? iso(sub.periodEnd) : null,
      billing_interval: sub.interval,
      plan_tier: live ? tier : 'free',
    })
    parts.push(`profile:${sub.status}`)
  } else {
    parts.push('profile:skipped-stale')
  }

  // Period. Only a paid, live subscription creates one; an existing period
  // is re-tiered on a mid-period plan change.
  const periodStartIso = iso(sub.periodStart)
  const periodEndIso = iso(sub.periodEnd)
  const allowance = periodAllowanceFor(tier)
  const existing = await store.getPeriod(sub.id, periodStartIso)
  if (existing) {
    if (existing.planTier !== tier || existing.periodEnd !== periodEndIso) {
      // Never drop below what was already used (the CHECK requires used <= allowance).
      await store.updatePeriod(existing.id, { planTier: tier, allowance: Math.max(allowance, existing.used), periodEndIso })
      parts.push(`period:retiered:${tier}`)
    } else {
      parts.push('period:unchanged')
    }
  } else if (opts.grantPeriod && (sub.status === 'active' || sub.status === 'trialing')) {
    const r = await store.insertPeriod({ userId, subscriptionId: sub.id, tier, periodStartIso, periodEndIso, allowance })
    parts.push(`period:${r}`)
  } else {
    parts.push('period:none')
  }
  return parts.join(' ')
}

// ── Event handlers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onCheckoutPaid(deps: WebhookDeps, session: any): Promise<string> {
  const { store } = deps
  const customerId = idOf(session.customer)
  const userId = await store.resolveUserId({
    userId: session.client_reference_id ?? session.metadata?.supabase_user_id ?? null,
    customerId,
  })
  if (!userId) throw new Error(`checkout ${session.id}: no Supabase user (client_reference_id/metadata/customer all unresolved)`)
  if (customerId) await store.linkCustomer(userId, customerId)

  if (session.mode === 'payment') {
    if (session.payment_status !== 'paid') return 'checkout:awaiting-payment'
    const tier = session.metadata?.tier
    if (tier !== 'single') throw new Error(`checkout ${session.id}: one-time payment for unexpected tier "${tier}"`)
    const r = await store.insertPurchase({
      userId,
      tier: 'single',
      checkoutSessionId: String(session.id),
      paymentIntentId: idOf(session.payment_intent),
      amountCents: typeof session.amount_total === 'number' ? session.amount_total : null,
      currency: String(session.currency ?? 'usd'),
    })
    return `purchase:${r}`
  }

  if (session.mode === 'subscription') {
    const subId = idOf(session.subscription)
    if (!subId) throw new Error(`checkout ${session.id}: subscription mode without a subscription id`)
    const sub = await deps.fetchSubscription(subId)
    return syncSubscription(deps, sub, { userIdHint: userId, grantPeriod: true })
  }

  return `checkout:ignored-mode:${session.mode}`
}

export async function handleStripeEvent(event: StripeEventLike, deps: WebhookDeps): Promise<HandleResult> {
  const obj = event.data.object
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return { action: await onCheckoutPaid(deps, obj) }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      // Re-fetch: events can arrive out of order; the live object is the truth.
      const sub = await deps.fetchSubscription(String(obj.id))
      return { action: await syncSubscription(deps, sub, { userIdHint: null, grantPeriod: false }) }
    }

    case 'customer.subscription.deleted': {
      // The event object is final; no fetch needed.
      const sub = snapshotSubscription(obj)
      return { action: await syncSubscription(deps, sub, { userIdHint: null, grantPeriod: false }) }
    }

    case 'invoice.paid': {
      const subId = invoiceSubscriptionId(obj)
      if (!subId) return { action: 'invoice:not-subscription' }
      const sub = await deps.fetchSubscription(subId)
      return { action: await syncSubscription(deps, sub, { userIdHint: null, grantPeriod: true }) }
    }

    case 'invoice.payment_failed': {
      const subId = invoiceSubscriptionId(obj)
      if (!subId) return { action: 'invoice:not-subscription' }
      const sub = await deps.fetchSubscription(subId)
      return { action: await syncSubscription(deps, sub, { userIdHint: null, grantPeriod: false }) }
    }

    default:
      return { action: 'ignored' }
  }
}

/**
 * Full webhook processing for an already signature-verified event: event-log
 * idempotency, handling, and recording the outcome. Throws on handler
 * failure so the route answers 500 and Stripe retries.
 */
export async function processStripeEvent(event: StripeEventLike, deps: WebhookDeps): Promise<HandleResult & { duplicate: boolean }> {
  const begin = await deps.store.beginEvent({ id: event.id, type: event.type, livemode: event.livemode, payload: event })
  if (begin === 'done') return { action: 'duplicate', duplicate: true }
  try {
    const r = await handleStripeEvent(event, deps)
    await deps.store.finishEvent(event.id, null)
    return { ...r, duplicate: false }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await deps.store.finishEvent(event.id, msg).catch(() => {})
    throw err
  }
}
