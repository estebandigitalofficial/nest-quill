import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  handleStripeEvent, processStripeEvent, snapshotSubscription, invoiceSubscriptionId,
  type BillingStore, type PeriodRow, type ProfileSubscriptionSync, type StripeEventLike, type SubscriptionSnapshot,
} from './webhook.ts'
import { paymentsEnabled, priceIdFor, tierForPriceId } from './config.ts'

const ENV = {
  STRIPE_PRICE_SINGLE: 'price_single',
  STRIPE_PRICE_STORY_PACK: 'price_pack',
  STRIPE_PRICE_STORY_PRO: 'price_pro',
}

const USER = 'user-1'
const CUSTOMER = 'cus_1'
const T0 = 1_760_000_000
const T1 = T0 + 30 * 86400
const T2 = T1 + 30 * 86400

// ── In-memory store ──────────────────────────────────────────────────────────

function memoryStore(opts: { users?: Record<string, string | null> } = {}) {
  const profiles = new Map<string, { customer: string | null; sync: Partial<ProfileSubscriptionSync> }>()
  for (const [id, customer] of Object.entries(opts.users ?? { [USER]: null })) profiles.set(id, { customer, sync: {} })
  const events = new Map<string, { processed: boolean; error: string | null }>()
  const purchases: { userId: string; tier: string; checkoutSessionId: string; amountCents: number | null }[] = []
  const periods: (PeriodRow & { userId: string; subscriptionId: string; periodStart: string })[] = []
  let n = 0

  const store: BillingStore = {
    async beginEvent(e) {
      const ex = events.get(e.id)
      if (!ex) { events.set(e.id, { processed: false, error: null }); return 'new' }
      return ex.processed ? 'done' : 'retry'
    },
    async finishEvent(id, error) {
      const ex = events.get(id)!
      if (error) ex.error = error
      else { ex.processed = true; ex.error = null }
    },
    async resolveUserId({ userId, customerId }) {
      if (userId && profiles.has(userId)) return userId
      for (const [id, p] of profiles) if (customerId && p.customer === customerId) return id
      return null
    },
    async linkCustomer(userId, customerId) {
      const p = profiles.get(userId)!
      if (!p.customer) p.customer = customerId
    },
    async insertPurchase(p) {
      if (purchases.some(x => x.checkoutSessionId === p.checkoutSessionId)) return 'exists'
      purchases.push({ userId: p.userId, tier: p.tier, checkoutSessionId: p.checkoutSessionId, amountCents: p.amountCents })
      return 'inserted'
    },
    async getProfileSubscription(userId) {
      const p = profiles.get(userId)
      if (!p) return null
      return { stripeSubscriptionId: p.sync.stripe_subscription_id ?? null, subscriptionStatus: p.sync.subscription_status ?? null }
    },
    async updateProfileSubscription(userId, fields) {
      const { stripe_customer_id: _c, ...rest } = fields
      profiles.get(userId)!.sync = rest
    },
    async getPeriod(subscriptionId, periodStartIso) {
      return periods.find(p => p.subscriptionId === subscriptionId && p.periodStart === periodStartIso) ?? null
    },
    async insertPeriod(p) {
      if (periods.some(x => x.subscriptionId === p.subscriptionId && x.periodStart === p.periodStartIso)) return 'exists'
      periods.push({ id: `per_${++n}`, userId: p.userId, subscriptionId: p.subscriptionId, planTier: p.tier, allowance: p.allowance, used: 0, periodStart: p.periodStartIso, periodEnd: p.periodEndIso })
      return 'inserted'
    },
    async updatePeriod(id, f) {
      const row = periods.find(p => p.id === id)!
      row.planTier = f.planTier
      row.allowance = f.allowance
      row.periodEnd = f.periodEndIso
    },
  }
  return { store, profiles, events, purchases, periods }
}

function subs(initial: Record<string, Partial<SubscriptionSnapshot>> = {}) {
  const map = new Map<string, SubscriptionSnapshot>()
  const put = (id: string, over: Partial<SubscriptionSnapshot>) => map.set(id, {
    id, customerId: CUSTOMER, status: 'active', priceId: 'price_pack', periodStart: T0, periodEnd: T1,
    cancelAt: null, cancelAtPeriodEnd: false, interval: 'month', metadataUserId: USER, metadataTier: 'story_pack',
    ...map.get(id), ...over,
  })
  for (const [id, over] of Object.entries(initial)) put(id, over)
  return { put, fetch: async (id: string) => { const s = map.get(id); if (!s) throw new Error(`no sub ${id}`); return s } }
}

const ev = (type: string, object: unknown, id = `evt_${type}_${Math.random()}`): StripeEventLike => ({ id, type, livemode: false, data: { object } })

const paidSession = (over: Record<string, unknown> = {}) => ({
  id: 'cs_1', mode: 'payment', payment_status: 'paid', customer: CUSTOMER, client_reference_id: USER,
  metadata: { supabase_user_id: USER, tier: 'single' }, payment_intent: 'pi_1', amount_total: 799, currency: 'usd', ...over,
})

// ── Config ───────────────────────────────────────────────────────────────────

test('config: price ids come from env, reverse lookup never guesses', () => {
  assert.equal(priceIdFor('single', ENV), 'price_single')
  assert.equal(priceIdFor('story_pro', {}), null)
  assert.equal(tierForPriceId('price_pro', ENV), 'story_pro')
  assert.equal(tierForPriceId('price_other', ENV), null)
  assert.equal(tierForPriceId(null, ENV), null)
  assert.equal(paymentsEnabled({ NEXT_PUBLIC_PAYMENTS_ENABLED: 'true' }), true)
  assert.equal(paymentsEnabled({ NEXT_PUBLIC_PAYMENTS_ENABLED: '1' }), false)
  assert.equal(paymentsEnabled({}), false)
})

// ── One-time book ────────────────────────────────────────────────────────────

test('paid one-time checkout creates exactly one purchase and links the customer', async () => {
  const m = memoryStore()
  const r = await handleStripeEvent(ev('checkout.session.completed', paidSession()), { store: m.store, fetchSubscription: subs().fetch, env: ENV })
  assert.equal(r.action, 'purchase:inserted')
  assert.deepEqual(m.purchases, [{ userId: USER, tier: 'single', checkoutSessionId: 'cs_1', amountCents: 799 }])
  assert.equal(m.profiles.get(USER)!.customer, CUSTOMER)
})

test('the same checkout delivered twice (different event ids) never double-grants', async () => {
  const m = memoryStore()
  const deps = { store: m.store, fetchSubscription: subs().fetch, env: ENV }
  await handleStripeEvent(ev('checkout.session.completed', paidSession()), deps)
  const r = await handleStripeEvent(ev('checkout.session.async_payment_succeeded', paidSession()), deps)
  assert.equal(r.action, 'purchase:exists')
  assert.equal(m.purchases.length, 1)
})

test('an unpaid (async) checkout grants nothing until async_payment_succeeded', async () => {
  const m = memoryStore()
  const deps = { store: m.store, fetchSubscription: subs().fetch, env: ENV }
  const r = await handleStripeEvent(ev('checkout.session.completed', paidSession({ payment_status: 'unpaid' })), deps)
  assert.equal(r.action, 'checkout:awaiting-payment')
  assert.equal(m.purchases.length, 0)
  await handleStripeEvent(ev('checkout.session.async_payment_succeeded', paidSession()), deps)
  assert.equal(m.purchases.length, 1)
})

test('a one-time checkout for a non-single tier is rejected, not granted', async () => {
  const m = memoryStore()
  await assert.rejects(
    handleStripeEvent(ev('checkout.session.completed', paidSession({ metadata: { tier: 'story_pro' } })), { store: m.store, fetchSubscription: subs().fetch, env: ENV }),
    /unexpected tier/,
  )
  assert.equal(m.purchases.length, 0)
})

test('a checkout that resolves to no Supabase user fails loudly', async () => {
  const m = memoryStore()
  await assert.rejects(
    handleStripeEvent(ev('checkout.session.completed', paidSession({ client_reference_id: 'ghost', metadata: { supabase_user_id: 'ghost', tier: 'single' }, customer: 'cus_unknown' })), { store: m.store, fetchSubscription: subs().fetch, env: ENV }),
    /no Supabase user/,
  )
})

// ── Subscriptions ────────────────────────────────────────────────────────────

test('subscription checkout syncs the profile and grants the first period', async () => {
  const m = memoryStore()
  const s = subs({ sub_1: {} })
  const r = await handleStripeEvent(ev('checkout.session.completed', { id: 'cs_s', mode: 'subscription', subscription: 'sub_1', customer: CUSTOMER, client_reference_id: USER, metadata: { tier: 'story_pack' } }), { store: m.store, fetchSubscription: s.fetch, env: ENV })
  assert.match(r.action, /period:inserted/)
  assert.equal(m.periods.length, 1)
  assert.equal(m.periods[0].planTier, 'story_pack')
  assert.equal(m.periods[0].allowance, 3)
  const sync = m.profiles.get(USER)!.sync
  assert.equal(sync.subscription_status, 'active')
  assert.equal(sync.plan_tier, 'story_pack')
  assert.equal(sync.stripe_subscription_id, 'sub_1')
  assert.equal(sync.current_period_end, new Date(T1 * 1000).toISOString())
})

test('invoice.paid after checkout for the same period is a no-op; the next period is granted', async () => {
  const m = memoryStore()
  const s = subs({ sub_1: {} })
  const deps = { store: m.store, fetchSubscription: s.fetch, env: ENV }
  await handleStripeEvent(ev('checkout.session.completed', { id: 'cs_s', mode: 'subscription', subscription: 'sub_1', customer: CUSTOMER, client_reference_id: USER }), deps)
  const same = await handleStripeEvent(ev('invoice.paid', { id: 'in_1', subscription: 'sub_1' }), deps)
  assert.match(same.action, /period:unchanged/)
  assert.equal(m.periods.length, 1)

  s.put('sub_1', { periodStart: T1, periodEnd: T2 })
  const renewal = await handleStripeEvent(ev('invoice.paid', { id: 'in_2', subscription: 'sub_1' }), deps)
  assert.match(renewal.action, /period:inserted/)
  assert.equal(m.periods.length, 2)
  assert.equal(m.periods[1].used, 0)
})

test('subscription.updated at renewal does not grant the unpaid new period', async () => {
  const m = memoryStore()
  const s = subs({ sub_1: { periodStart: T1, periodEnd: T2 } })
  const r = await handleStripeEvent(ev('customer.subscription.updated', { id: 'sub_1' }), { store: m.store, fetchSubscription: s.fetch, env: ENV })
  assert.match(r.action, /period:none/)
  assert.equal(m.periods.length, 0)
  assert.equal(m.profiles.get(USER)!.sync.subscription_status, 'active')
})

test('a mid-period upgrade re-tiers the current period and keeps what was used', async () => {
  const m = memoryStore()
  const s = subs({ sub_1: {} })
  const deps = { store: m.store, fetchSubscription: s.fetch, env: ENV }
  await handleStripeEvent(ev('invoice.paid', { subscription: 'sub_1' }), deps)
  m.periods[0].used = 2
  s.put('sub_1', { priceId: 'price_pro' })
  const r = await handleStripeEvent(ev('customer.subscription.updated', { id: 'sub_1' }), deps)
  assert.match(r.action, /period:retiered:story_pro/)
  assert.equal(m.periods.length, 1)
  assert.equal(m.periods[0].planTier, 'story_pro')
  assert.equal(m.periods[0].allowance, 6)
  assert.equal(m.periods[0].used, 2)
  assert.equal(m.profiles.get(USER)!.sync.plan_tier, 'story_pro')
})

test('a downgrade never sets allowance below what was already used', async () => {
  const m = memoryStore()
  const s = subs({ sub_1: { priceId: 'price_pro' } })
  const deps = { store: m.store, fetchSubscription: s.fetch, env: ENV }
  await handleStripeEvent(ev('invoice.paid', { subscription: 'sub_1' }), deps)
  m.periods[0].used = 5
  s.put('sub_1', { priceId: 'price_pack' })
  await handleStripeEvent(ev('customer.subscription.updated', { id: 'sub_1' }), deps)
  assert.equal(m.periods[0].planTier, 'story_pack')
  assert.equal(m.periods[0].allowance, 5)
})

test('payment failure marks the profile past_due and keeps the paid period', async () => {
  const m = memoryStore()
  const s = subs({ sub_1: {} })
  const deps = { store: m.store, fetchSubscription: s.fetch, env: ENV }
  await handleStripeEvent(ev('invoice.paid', { subscription: 'sub_1' }), deps)
  s.put('sub_1', { status: 'past_due', periodStart: T1, periodEnd: T2 })
  await handleStripeEvent(ev('invoice.payment_failed', { subscription: 'sub_1' }), deps)
  assert.equal(m.profiles.get(USER)!.sync.subscription_status, 'past_due')
  assert.equal(m.periods.length, 1) // no new period without payment
})

test('cancellation drops the profile to free but leaves the paid period usable', async () => {
  const m = memoryStore()
  const s = subs({ sub_1: {} })
  const deps = { store: m.store, fetchSubscription: s.fetch, env: ENV }
  await handleStripeEvent(ev('invoice.paid', { subscription: 'sub_1' }), deps)
  const deleted = {
    id: 'sub_1', customer: CUSTOMER, status: 'canceled', current_period_start: T0, current_period_end: T1,
    cancel_at: null, cancel_at_period_end: false, metadata: { supabase_user_id: USER, tier: 'story_pack' },
    items: { data: [{ price: { id: 'price_pack', recurring: { interval: 'month' } } }] },
  }
  await handleStripeEvent(ev('customer.subscription.deleted', deleted), deps)
  const sync = m.profiles.get(USER)!.sync
  assert.equal(sync.subscription_status, 'canceled')
  assert.equal(sync.plan_tier, 'free')
  assert.equal(m.periods.length, 1)
  assert.equal(m.periods[0].allowance, 3)
})

test('a stale event for an old canceled subscription does not clobber a newer live one', async () => {
  const m = memoryStore()
  const s = subs({ sub_new: { priceId: 'price_pro' }, sub_old: { status: 'canceled' } })
  const deps = { store: m.store, fetchSubscription: s.fetch, env: ENV }
  await handleStripeEvent(ev('invoice.paid', { subscription: 'sub_new' }), deps)
  const r = await handleStripeEvent(ev('customer.subscription.updated', { id: 'sub_old' }), deps)
  assert.match(r.action, /profile:skipped-stale/)
  assert.equal(m.profiles.get(USER)!.sync.stripe_subscription_id, 'sub_new')
  assert.equal(m.profiles.get(USER)!.sync.plan_tier, 'story_pro')
})

test('subscription user resolves by customer id when metadata is missing', async () => {
  const m = memoryStore({ users: { [USER]: CUSTOMER } })
  const s = subs({ sub_1: { metadataUserId: null } })
  await handleStripeEvent(ev('invoice.paid', { subscription: 'sub_1' }), { store: m.store, fetchSubscription: s.fetch, env: ENV })
  assert.equal(m.periods[0].userId, USER)
})

test('an unknown price with no tier metadata fails instead of guessing a plan', async () => {
  const m = memoryStore()
  const s = subs({ sub_1: { priceId: 'price_mystery', metadataTier: null } })
  await assert.rejects(
    handleStripeEvent(ev('invoice.paid', { subscription: 'sub_1' }), { store: m.store, fetchSubscription: s.fetch, env: ENV }),
    /does not map to a plan/,
  )
  assert.equal(m.periods.length, 0)
})

test('one-time invoices and unrelated events are ignored', async () => {
  const m = memoryStore()
  const deps = { store: m.store, fetchSubscription: subs().fetch, env: ENV }
  assert.equal((await handleStripeEvent(ev('invoice.paid', { id: 'in_x', subscription: null }), deps)).action, 'invoice:not-subscription')
  assert.equal((await handleStripeEvent(ev('customer.created', { id: 'cus_x' }), deps)).action, 'ignored')
})

// ── Event-level idempotency ──────────────────────────────────────────────────

test('a redelivered, already-processed event is acknowledged without running', async () => {
  const m = memoryStore()
  const deps = { store: m.store, fetchSubscription: subs().fetch, env: ENV }
  const e = ev('checkout.session.completed', paidSession(), 'evt_same')
  const first = await processStripeEvent(e, deps)
  assert.equal(first.duplicate, false)
  m.purchases.length = 0 // prove the second delivery does not touch the store
  const second = await processStripeEvent(e, deps)
  assert.equal(second.duplicate, true)
  assert.equal(m.purchases.length, 0)
})

test('a failed event records the error, rethrows, and succeeds on retry', async () => {
  const m = memoryStore()
  let fail = true
  const s = subs({ sub_1: {} })
  const deps = { store: m.store, fetchSubscription: async (id: string) => { if (fail) throw new Error('stripe down'); return s.fetch(id) }, env: ENV }
  const e = ev('invoice.paid', { subscription: 'sub_1' }, 'evt_retry')
  await assert.rejects(processStripeEvent(e, deps), /stripe down/)
  assert.equal(m.events.get('evt_retry')!.error, 'stripe down')
  assert.equal(m.events.get('evt_retry')!.processed, false)
  fail = false
  const r = await processStripeEvent(e, deps)
  assert.equal(r.duplicate, false)
  assert.equal(m.events.get('evt_retry')!.processed, true)
  assert.equal(m.periods.length, 1)
})

// ── Normalisation across Stripe API versions ─────────────────────────────────

test('snapshotSubscription reads the period from the subscription or its first item', () => {
  const base = { id: 'sub_1', customer: { id: CUSTOMER }, status: 'active', metadata: {} }
  const old = snapshotSubscription({ ...base, current_period_start: T0, current_period_end: T1, items: { data: [{ price: { id: 'price_pack' } }] } })
  const basil = snapshotSubscription({ ...base, items: { data: [{ current_period_start: T0, current_period_end: T1, price: { id: 'price_pack', recurring: { interval: 'month' } } }] } })
  for (const s of [old, basil]) {
    assert.equal(s.periodStart, T0)
    assert.equal(s.periodEnd, T1)
    assert.equal(s.customerId, CUSTOMER)
    assert.equal(s.priceId, 'price_pack')
  }
  assert.throws(() => snapshotSubscription({ ...base, items: { data: [] } }), /no current period/)
})

test('invoiceSubscriptionId reads both the legacy and the parent location', () => {
  assert.equal(invoiceSubscriptionId({ subscription: 'sub_a' }), 'sub_a')
  assert.equal(invoiceSubscriptionId({ subscription: { id: 'sub_b' } }), 'sub_b')
  assert.equal(invoiceSubscriptionId({ parent: { subscription_details: { subscription: 'sub_c' } } }), 'sub_c')
  assert.equal(invoiceSubscriptionId({}), null)
})
