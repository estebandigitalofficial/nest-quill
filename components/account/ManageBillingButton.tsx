'use client'

// Opens the Stripe customer portal (card, plan change, cancel, invoices).

import { useState } from 'react'
import { openBillingPortal } from '@/lib/stripe/client'
import { useLanguage } from '@/lib/i18n/context'

export default function ManageBillingButton() {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function go() {
    setBusy(true)
    setFailed(false)
    const r = await openBillingPortal()
    if (r.ok) { window.location.href = r.url; return }
    setFailed(true)
    setBusy(false)
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2 disabled:opacity-60"
      >
        {busy ? t.checkout.opening : t.checkout.manageBilling}
      </button>
      {failed && <p className="text-[11px] text-red-600 mt-1">{t.checkout.failed}</p>}
    </div>
  )
}
