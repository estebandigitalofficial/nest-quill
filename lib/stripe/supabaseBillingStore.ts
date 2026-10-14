// Server-only Supabase implementation of BillingStore (see webhook.ts).
//
// Uses the service-role client: the webhook is the one place Stripe-sourced
// entitlements are written, and those tables have RLS on with no policies.
// Every write is a single idempotent statement keyed on a Stripe id.
//
// Never import from a client component.

import { createAdminClient } from '@/lib/supabase/admin'
import { isPaidTier } from '@/lib/entitlements/policy'
import type { BillingStore, PeriodRow } from './webhook'

const UNIQUE_VIOLATION = '23505'

export function supabaseBillingStore(): BillingStore {
  const db = createAdminClient()
  return {
    async beginEvent(e) {
      const { error } = await db.from('stripe_webhook_events').insert({
        event_id: e.id,
        type: e.type,
        livemode: e.livemode,
        payload: e.payload,
      })
      if (!error) return 'new'
      if (error.code !== UNIQUE_VIOLATION) throw new Error(`stripe_webhook_events insert: ${error.message}`)
      const { data } = await db.from('stripe_webhook_events').select('processed_at').eq('event_id', e.id).maybeSingle()
      return (data as { processed_at: string | null } | null)?.processed_at ? 'done' : 'retry'
    },

    async finishEvent(id, error) {
      await db
        .from('stripe_webhook_events')
        .update(error ? { error } : { processed_at: new Date().toISOString(), error: null })
        .eq('event_id', id)
    },

    async resolveUserId({ userId, customerId }) {
      if (userId) {
        const { data } = await db.from('profiles').select('id').eq('id', userId).maybeSingle()
        if (data) return (data as { id: string }).id
      }
      if (customerId) {
        const { data } = await db.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle()
        if (data) return (data as { id: string }).id
      }
      return null
    },

    async linkCustomer(userId, customerId) {
      await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId).is('stripe_customer_id', null)
    },

    async insertPurchase(p) {
      const { error } = await db.from('story_purchases').insert({
        user_id: p.userId,
        tier: p.tier,
        status: 'paid',
        source: 'stripe',
        stripe_checkout_session_id: p.checkoutSessionId,
        stripe_payment_intent_id: p.paymentIntentId,
        amount_cents: p.amountCents,
        currency: p.currency,
      })
      if (!error) return 'inserted'
      if (error.code === UNIQUE_VIOLATION) return 'exists'
      throw new Error(`story_purchases insert: ${error.message}`)
    },

    async getProfileSubscription(userId) {
      const { data } = await db.from('profiles').select('stripe_subscription_id, subscription_status').eq('id', userId).maybeSingle()
      if (!data) return null
      const row = data as { stripe_subscription_id: string | null; subscription_status: string | null }
      return { stripeSubscriptionId: row.stripe_subscription_id, subscriptionStatus: row.subscription_status }
    },

    async updateProfileSubscription(userId, fields) {
      // stripe_customer_id is only linked (never overwritten) via linkCustomer.
      const { stripe_customer_id: _ignored, ...rest } = fields
      const { error } = await db.from('profiles').update(rest).eq('id', userId)
      if (error) throw new Error(`profiles subscription sync: ${error.message}`)
    },

    async getPeriod(subscriptionId, periodStartIso): Promise<PeriodRow | null> {
      const { data } = await db
        .from('subscription_periods')
        .select('id, plan_tier, allowance, used, period_end')
        .eq('stripe_subscription_id', subscriptionId)
        .eq('period_start', periodStartIso)
        .maybeSingle()
      if (!data) return null
      const row = data as { id: string; plan_tier: string; allowance: number; used: number; period_end: string }
      if (!isPaidTier(row.plan_tier) || row.plan_tier === 'single') return null
      return {
        id: row.id,
        planTier: row.plan_tier,
        allowance: row.allowance,
        used: row.used,
        // Postgres returns "+00:00"; normalise so equality with toISOString() holds.
        periodEnd: new Date(row.period_end).toISOString(),
      }
    },

    async insertPeriod(p) {
      const { error } = await db.from('subscription_periods').insert({
        user_id: p.userId,
        stripe_subscription_id: p.subscriptionId,
        plan_tier: p.tier,
        period_start: p.periodStartIso,
        period_end: p.periodEndIso,
        allowance: p.allowance,
        source: 'stripe',
      })
      if (!error) return 'inserted'
      if (error.code === UNIQUE_VIOLATION) return 'exists'
      throw new Error(`subscription_periods insert: ${error.message}`)
    },

    async updatePeriod(id, fields) {
      const { error } = await db
        .from('subscription_periods')
        .update({ plan_tier: fields.planTier, allowance: fields.allowance, period_end: fields.periodEndIso })
        .eq('id', id)
      if (error) throw new Error(`subscription_periods update: ${error.message}`)
    },
  }
}
