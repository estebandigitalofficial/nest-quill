'use client'

// Per-story action buttons. Two modes:
//   mode="archive"  → confirm + POST /api/story/[id]/archive, then refresh
//   mode="restore"  → POST /api/story/[id]/restore, no confirm needed, then refresh
//
// Server-side ownership is the source of truth — these buttons just send the
// request. Failure surfaces an inline message; success refreshes the page so
// the row drops out of the current list.
//
// 3C-4: on the archived list a FAILED story may additionally offer
// "Delete permanently" (`deletable`, decided by the parent from the server
// setting plus archived + failed). It opens DeleteStoryDialog and sends the
// existing DELETE /api/story/[id] through useStoryDeletion; the list removes
// the row and shows the outcome. Restore is a normal action, Delete is the
// destructive one, and neither is clickable while the other is in flight.
// The Delete button renders from md up only: phones get their own
// presentation in 3C-5, built on the same hook and dialog.

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n/context'
import DeleteStoryDialog from './DeleteStoryDialog'
import { useStoryDeletion } from './useStoryDeletion'
import { deleteNoticeKey, type RemovedOutcome } from '@/lib/account/storyDeletion'

interface Props {
  requestId: string
  mode: 'archive' | 'restore'
  /** Offer permanent deletion (archived failed story, setting on). Default false. */
  deletable?: boolean
  /** The story is no longer listed for this customer; the list drops the row. */
  onRemoved?: (requestId: string, outcome: RemovedOutcome) => void
}

export default function StoryRowActions({ requestId, mode, deletable = false, onRemoved }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const a = t.account
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deleteTrigger = useRef<HTMLButtonElement>(null)
  const del = useStoryDeletion({ requestId, onRemoved: (id, outcome) => onRemoved?.(id, outcome) })

  async function go() {
    if (del.pending) return
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

  function cancelDelete() {
    del.cancel()
    deleteTrigger.current?.focus()
  }

  const deleteErrorKey = del.error ? deleteNoticeKey(del.error) : null
  const message = error ?? (deleteErrorKey ? a[deleteErrorKey] : null)

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={go}
        disabled={busy || del.pending}
        className={
          mode === 'archive'
            ? 'text-[11px] font-semibold text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors'
            : 'text-[11px] font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 transition-colors'
        }
        aria-label={mode === 'archive' ? a.archiveAria : a.restoreAria}
      >
        {busy ? '…' : mode === 'archive' ? a.archive : a.restore}
      </button>
      {deletable && (
        <button
          ref={deleteTrigger}
          type="button"
          onClick={del.open}
          disabled={busy || del.pending}
          aria-haspopup="dialog"
          aria-label={a.deleteAria}
          className="hidden md:inline-flex text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          {del.pending ? a.deletePending : a.deleteForever}
        </button>
      )}
      {message && <span role="alert" className="text-[10px] text-red-500 text-right">{message}</span>}
      {deletable && (
        <DeleteStoryDialog
          open={del.confirming || del.pending}
          pending={del.pending}
          onCancel={cancelDelete}
          onConfirm={del.confirm}
        />
      )}
    </div>
  )
}
