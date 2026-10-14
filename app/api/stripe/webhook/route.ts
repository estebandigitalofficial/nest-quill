// POST /api/stripe/webhook
//
// Stripe → Nest & Quill. Verifies the Stripe-Signature header against the
// raw body with STRIPE_WEBHOOK_SECRET, then hands the event to
// processStripeEvent (lib/stripe/webhook.ts), which is idempotent on the
// event id and is the only writer of Stripe-sourced entitlements.
//
// Responses: 400 bad/missing signature (Stripe does not retry), 500 handler
// failure (Stripe retries with backoff), 200 otherwise, including events we
// ignore and duplicates.

import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/server'
import { processStripeEvent, snapshotSubscription } from '@/lib/stripe/webhook'
import { supabaseBillingStore } from '@/lib/stripe/supabaseBillingStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const stripe = getStripe()
  const body = await request.text()
  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    console.warn('[stripe/webhook] signature verification failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const result = await processStripeEvent(event, {
      store: supabaseBillingStore(),
      fetchSubscription: async (id) => snapshotSubscription(await stripe.subscriptions.retrieve(id)),
    })
    return NextResponse.json({ received: true, action: result.action })
  } catch (err) {
    console.error(`[stripe/webhook] ${event.type} ${event.id} failed`, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }
}
