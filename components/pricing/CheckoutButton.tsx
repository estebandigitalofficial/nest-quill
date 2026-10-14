'use client'

// Paid-plan CTA used when payments are enabled. Starts Stripe Checkout; a
// guest is sent to login first and returns to the pricing page.

import { useState } from 'react'
import type { PaidTier } from '@/lib/entitlements/policy'
import { startCheckout, followCheckoutFailure } from '@/lib/stripe/client'
import { useLanguage } from '@/lib/i18n/context'

export default function CheckoutButton({ tier, label, className }: { tier: PaidTier; label: string; className?: string }) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    const r = await startCheckout(tier, 'pricing')
    if (r.ok) { window.location.href = r.url; return }
    if (await followCheckoutFailure(r.code, '/pricing')) return
    setError(r.code === 'NOT_CONFIGURED' ? t.checkout.unavailable : t.checkout.failed)
    setBusy(false)
  }

  return (
    <>
      <button type="button" onClick={go} disabled={busy} className={className}>
        {busy ? t.checkout.starting : label}
      </button>
      {error && <p className="text-xs text-red-600 text-center mt-2">{error}</p>}
    </>
  )
}
