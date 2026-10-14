'use client'

// Browser-side helpers for the Stripe routes. No keys, no SDK: the server
// creates the session and returns a URL; the browser only navigates.

import type { PaidTier } from '@/lib/entitlements/policy'

export type CheckoutStart =
  | { ok: true; url: string }
  | { ok: false; code: string }

export async function startCheckout(tier: PaidTier, from: 'create' | 'pricing'): Promise<CheckoutStart> {
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, from }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok && typeof json.url === 'string') return { ok: true, url: json.url }
    return { ok: false, code: typeof json.code === 'string' ? json.code : 'CHECKOUT_FAILED' }
  } catch {
    return { ok: false, code: 'CHECKOUT_FAILED' }
  }
}

export async function openBillingPortal(): Promise<CheckoutStart> {
  try {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    if (res.ok && typeof json.url === 'string') return { ok: true, url: json.url }
    return { ok: false, code: typeof json.code === 'string' ? json.code : 'PORTAL_FAILED' }
  } catch {
    return { ok: false, code: 'PORTAL_FAILED' }
  }
}

/**
 * Shared follow-up for a failed checkout start: guests go to login and come
 * back to `next`, existing subscribers go to the portal. Returns true when it
 * navigated away, false when the caller should show an error.
 */
export async function followCheckoutFailure(code: string, next: string): Promise<boolean> {
  if (code === 'ACCOUNT_REQUIRED') {
    window.location.href = `/login?next=${encodeURIComponent(next)}`
    return true
  }
  if (code === 'ALREADY_SUBSCRIBED') {
    const portal = await openBillingPortal()
    if (portal.ok) { window.location.href = portal.url; return true }
  }
  return false
}
