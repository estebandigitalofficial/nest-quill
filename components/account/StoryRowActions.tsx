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
import { useLanguage } from '@/lib/i18n/context'

interface Props {
  requestId: string
  mode: 'archive' | 'restore'
}

export default function StoryRowActions({ requestId, mode }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const a = t.account
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    if (mode === 'archive') {
      const ok = window.confirm(a.confirmArchive)
      if (!ok) return
    }
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/story/${requestId}/${mode}`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.message ?? a.actionFailed)
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
        aria-label={mode === 'archive' ? a.archiveAria : a.restoreAria}
      >
        {busy ? '…' : mode === 'archive' ? a.archive : a.restore}
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}
