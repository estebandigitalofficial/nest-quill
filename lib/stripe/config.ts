/**
 * STRIPE CATALOGUE — pure, no I/O, no SDK.
 *
 * Maps the three purchasable launch tiers to Stripe price ids. Price ids are
 * never hardcoded: they come from env vars set per environment (test-mode
 * ids on preview, live ids on production), so the same build works against
 * either Stripe mode.
 *
 *   single      STRIPE_PRICE_SINGLE        one-time Checkout (mode=payment)
 *   story_pack  STRIPE_PRICE_STORY_PACK    monthly subscription
 *   story_pro   STRIPE_PRICE_STORY_PRO     monthly subscription
 *
 * Every function takes an optional env map so tests can pass their own.
 */

import type { PaidTier } from '../entitlements/policy.ts'

type Env = Record<string, string | undefined>

export const PRICE_ENV: Record<PaidTier, string> = {
  single: 'STRIPE_PRICE_SINGLE',
  story_pack: 'STRIPE_PRICE_STORY_PACK',
  story_pro: 'STRIPE_PRICE_STORY_PRO',
}

export const CHECKOUT_MODE: Record<PaidTier, 'payment' | 'subscription'> = {
  single: 'payment',
  story_pack: 'subscription',
  story_pro: 'subscription',
}

/** The public payments switch. Off unless explicitly the string "true". */
export function paymentsEnabled(env: Env = process.env): boolean {
  return env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true'
}

export function priceIdFor(tier: PaidTier, env: Env = process.env): string | null {
  const v = env[PRICE_ENV[tier]]?.trim()
  return v ? v : null
}

/** Reverse lookup used by the webhook. Unknown price → null (never guessed). */
export function tierForPriceId(priceId: string | null | undefined, env: Env = process.env): PaidTier | null {
  if (!priceId) return null
  for (const tier of Object.keys(PRICE_ENV) as PaidTier[]) {
    if (priceIdFor(tier, env) === priceId) return tier
  }
  return null
}

/**
 * Stripe subscription statuses that still give access to the current,
 * already-paid period. A subscription in any of these blocks a second
 * subscription checkout (the customer is sent to the portal instead).
 */
export const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const

export function isLiveSubscriptionStatus(status: string | null | undefined): boolean {
  return !!status && (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status)
}
