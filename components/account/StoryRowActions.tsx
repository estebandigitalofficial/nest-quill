'use client'

// Per-story action button. Two modes:
//   mode="archive"  → confirm + POST /api/story/[id]/archive, then refresh
//   mode="restore"  → POST /api/story/[id]/restore, no confirm needed, then refresh
//
// Server-side ownership is the source of truth — these buttons just send the
// request. Failure surfaces an inline message; success refreshes the page so
// the row drops out of the current list.

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  requestId: string
  mode: 'archive' | 'restore'
}

export default function StoryRowActions({ requestId, mode }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    if (mode === 'archive') {
      const ok = window.confirm('Archive this story? You can restore it later from your archived list.')
      if (!ok) return
    }
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/story/${requestId}/${mode}`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.message ?? 'Something went wrong.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className={
          mode === 'archive'
            ? 'text-[11px] font-semibold text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors'
            : 'text-[11px] font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 transition-colors'
        }
        aria-label={mode === 'archive' ? 'Archive story' : 'Restore story'}
      >
        {busy ? '…' : mode === 'archive' ? 'Archive' : 'Restore'}
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}
