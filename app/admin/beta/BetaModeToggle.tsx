'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BetaModeToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  function handleClick() {
    setError(null)
    if (!enabled) {
      // Enabling requires confirmation
      setShowConfirm(true)
    } else {
      // Disabling is immediate
      void commit(false)
    }
  }

  async function commit(next: boolean) {
    setShowConfirm(false)
    setLoading(true)
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
    <>
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
          onClick={handleClick}
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

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-adm-surface border border-adm-border rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div>
              <p className="font-semibold text-white text-base">Enable Beta Mode?</p>
              <p className="text-sm text-adm-muted mt-1.5 leading-relaxed">
                Beta Mode affects all users globally. Story limits will be bypassed and some generation will be simulated until you turn it off.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => commit(true)}
                className="text-sm font-semibold px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              >
                Yes, enable
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-sm font-semibold text-adm-muted hover:text-white px-4 py-2.5 rounded-xl border border-adm-border hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
