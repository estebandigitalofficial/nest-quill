// POST /api/stripe/checkout   body: { tier: 'single' | 'story_pack' | 'story_pro', from?: 'create' | 'pricing' }
//
// Creates a Stripe Checkout Session and returns its URL. Grants nothing:
// the purchase or subscription period is written only by the webhook after
// Stripe confirms payment. Paid plans require an account (same rule as the
// entitlement policy), so guests get 401 and the client sends them to login.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, getOrCreateStripeCustomer } from '@/lib/stripe/server'
import { CHECKOUT_MODE, isLiveSubscriptionStatus, paymentsEnabled, priceIdFor } from '@/lib/stripe/config'
import { isPaidTier } from '@/lib/entitlements/policy'
import { internalOrigin } from '@/lib/utils/internalOrigin'
import { getServerLang } from '@/lib/i18n/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!paymentsEnabled()) {
    return NextResponse.json({ code: 'PAYMENTS_DISABLED', message: 'Payments are not enabled.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const tier = body?.tier
  if (!isPaidTier(tier)) {
    return NextResponse.json({ code: 'INVALID_TIER', message: 'Unknown plan.' }, { status: 400 })
  }
  const from: 'create' | 'pricing' = body?.from === 'pricing' ? 'pricing' : 'create'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ code: 'ACCOUNT_REQUIRED', message: 'Sign in to buy a plan.' }, { status: 401 })
  }

  const priceId = priceIdFor(tier)
  if (!priceId) {
    console.error(`[stripe/checkout] price id for ${tier} is not configured`)
    return NextResponse.json({ code: 'NOT_CONFIGURED', message: 'This plan is not available right now.' }, { status: 503 })
  }

  const mode = CHECKOUT_MODE[tier]
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, subscription_status')
    .eq('id', user.id)
    .maybeSingle()
  const prof = profile as { display_name?: string | null; subscription_status?: string | null } | null

  // One subscription per account. Plan changes and cancellations go through
  // the Stripe customer portal so proration stays Stripe's job.
  if (mode === 'subscription' && isLiveSubscriptionStatus(prof?.subscription_status)) {
    return NextResponse.json(
      { code: 'ALREADY_SUBSCRIBED', message: 'You already have a subscription. Manage it from your account.' },
      { status: 409 },
    )
  }

  try {
    const customerId = await getOrCreateStripeCustomer({
      userId: user.id,
      email: user.email,
      displayName: prof?.display_name ?? null,
    })

    const origin = internalOrigin(request)
    const lang = await getServerLang()
    const metadata = { supabase_user_id: user.id, tier }
    const successUrl = `${origin}/create?plan=${tier}&checkout=success`
    const cancelUrl = from === 'pricing' ? `${origin}/pricing?checkout=cancelled` : `${origin}/create?plan=${tier}&checkout=cancelled`

    const session = await getStripe().checkout.sessions.create({
      mode,
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata,
      ...(mode === 'payment'
        ? { payment_intent_data: { metadata } }
        : { subscription_data: { metadata } }),
      allow_promotion_codes: true,
      locale: lang === 'es' ? 'es' : 'en',
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    if (!session.url) throw new Error('Checkout session has no URL')
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/checkout] failed', err)
    return NextResponse.json({ code: 'CHECKOUT_FAILED', message: 'Could not start checkout. Please try again.' }, { status: 500 })
  }
}
