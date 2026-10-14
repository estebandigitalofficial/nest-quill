// POST /api/stripe/portal
//
// Opens the Stripe customer portal for the signed-in user (update card,
// change plan, cancel, invoices). Returns { url }. Changes made there come
// back through the webhook like any other subscription event.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'
import { paymentsEnabled } from '@/lib/stripe/config'
import { internalOrigin } from '@/lib/utils/internalOrigin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!paymentsEnabled()) {
    return NextResponse.json({ code: 'PAYMENTS_DISABLED', message: 'Payments are not enabled.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ code: 'ACCOUNT_REQUIRED', message: 'Sign in first.' }, { status: 401 })

  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()
  const customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id
  if (!customerId) {
    return NextResponse.json({ code: 'NO_BILLING_ACCOUNT', message: 'No billing account yet.' }, { status: 404 })
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${internalOrigin(request)}/account`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe/portal] failed', err)
    return NextResponse.json({ code: 'PORTAL_FAILED', message: 'Could not open billing. Please try again.' }, { status: 500 })
  }
}
