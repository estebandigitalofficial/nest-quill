/**
 * STRIPE SERVER HELPERS
 *
 * Server-only. Never import this in client components.
 *
 * Lazy initialisation: the SDK is constructed on first use so a missing
 * STRIPE_SECRET_KEY does not break builds or unrelated runtime paths.
 * Payments are gated by NEXT_PUBLIC_PAYMENTS_ENABLED in the submission
 * route — this module is currently only used by future checkout/webhook
 * routes; importing it has no side effects until a function is called.
 */

import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

let cachedClient: Stripe | null = null

/**
 * Returns a singleton Stripe SDK client. Throws if STRIPE_SECRET_KEY is
 * missing so callers fail loudly during request handling rather than at
 * module load.
 */
export function getStripe(): Stripe {
  if (cachedClient) return cachedClient
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set. Add it before invoking Stripe-backed routes.')
  }
  // Pin the API version to whatever ships with the installed SDK so
  // upgrading the package is the explicit moment the API contract changes.
  cachedClient = new Stripe(key, { typescript: true })
  return cachedClient
}

/**
 * Returns the existing Stripe customer ID for a user, creating one if
 * needed and persisting it to profiles.stripe_customer_id.
 *
 * Idempotent — safe to call on every checkout request. Uses the admin
 * client so it works from server routes regardless of RLS.
 */
export async function getOrCreateStripeCustomer(args: {
  userId: string
  email: string
  displayName?: string | null
}): Promise<string> {
  const { userId, email, displayName } = args
  const admin = createAdminClient()

  const { data: profile, error: readErr } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()
  if (readErr) {
    throw new Error(`Failed to read profile for ${userId}: ${readErr.message}`)
  }

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id as string
  }

  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email,
    name: displayName ?? undefined,
    // Lets the webhook resolve customer → user without an extra round trip.
    metadata: { supabase_user_id: userId },
  })

  const { error: writeErr } = await admin
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)
  if (writeErr) {
    // The customer exists in Stripe but isn't linked locally. Surface the
    // error rather than swallowing it — the next call would create a
    // duplicate Stripe customer otherwise.
    throw new Error(`Stripe customer ${customer.id} created but profile update failed: ${writeErr.message}`)
  }

  return customer.id
}
