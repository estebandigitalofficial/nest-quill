'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BetaModeToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setError(null)
    setLoading(true)
    const next = !enabled
    const res = await fetch('/api/admin/app-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'beta_mode_enabled', value: next }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }
    setEnabled(next)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-sm font-semibold text-white">
          Beta Mode is{' '}
          <span className={enabled ? 'text-amber-400' : 'text-adm-subtle'}>
            {enabled ? 'ENABLED' : 'disabled'}
          </span>
        </p>
        <p className="text-xs text-adm-muted mt-1">
          {enabled
            ? 'All story limits bypassed (guest, free, and paid). Images and PDFs are simulated. A banner is shown to all users.'
            : 'Normal operation. All limits and AI generation active.'}
        </p>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`shrink-0 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
          enabled
            ? 'bg-adm-surface border border-adm-border text-adm-muted hover:bg-white/5'
            : 'bg-amber-600 hover:bg-amber-700 text-white'
        }`}
      >
        {loading ? 'Saving…' : enabled ? 'Disable Beta Mode' : 'Enable Beta Mode'}
      </button>
    </div>
  )
}
