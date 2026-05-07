'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TourEnableToggle({
  tourId, initialEnabled,
}: { tourId: string; initialEnabled: boolean }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    setSaving(true)
    const next = !enabled
    setEnabled(next)
    try {
      const res = await fetch(`/api/admin/tours/${tourId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) setEnabled(!next) // revert on failure
      else router.refresh()
    } catch {
      setEnabled(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        enabled
          ? 'bg-green-500/10 border-green-500/40 text-green-300 hover:bg-green-500/20'
          : 'bg-adm-bg border-adm-border text-adm-muted hover:text-adm-text'
      }`}
    >
      {enabled ? 'Enabled' : 'Disabled'}
    </button>
  )
}
