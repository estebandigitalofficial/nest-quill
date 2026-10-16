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
// "Delete permanently" (`deletable`, decided by StoryRow from the server
// setting plus archived + failed). StoryRow owns the deletion flow and the
// confirmation dialog; this component only renders the triggers:
//   - desktop (md and up): the red "Delete permanently" text button;
//   - phones (below md): a "More actions" button that reveals the row's
//     Delete panel from a plain tap or keypress (3C-5), so nobody has to
//     slide the row to reach it. Restore is a normal action, Delete is the
//     destructive one, and neither is clickable while the other is in flight.

import { useRouter } from 'next/navigation'
import { useState, type RefObject } from 'react'
import { useLanguage } from '@/lib/i18n/context'
import { deleteNoticeKey, type DeleteFlowState } from '@/lib/account/storyDeletion'

interface Props {
  requestId: string
  mode: 'archive' | 'restore'
  /** Offer permanent deletion (archived failed story, setting on). Default false. */
  deletable?: boolean
  /** The row's DELETE request is in flight. */
  deletePending?: boolean
  /** Last outcome that kept the row (shown next to the actions). */
  deleteError?: DeleteFlowState['error']
  /** Open the row's confirmation dialog; receives the element to return focus to. */
  onDelete?: (trigger: HTMLElement | null) => void
  /** Phone panel state, for the "More actions" disclosure. */
  revealed?: boolean
  onToggleReveal?: () => void
  moreButtonRef?: RefObject<HTMLButtonElement | null>
}

export default function StoryRowActions({ requestId, mode, deletable = false, deletePending = false, deleteError = null, onDelete, revealed = false, onToggleReveal, moreButtonRef }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const a = t.account
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    if (deletePending) return
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

  const deleteErrorKey = deleteError ? deleteNoticeKey(deleteError) : null
  const message = error ?? (deleteErrorKey ? a[deleteErrorKey] : null)

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={go}
          disabled={busy || deletePending}
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
            type="button"
            onClick={e => onDelete?.(e.currentTarget)}
            disabled={busy || deletePending}
            aria-haspopup="dialog"
            aria-label={a.deleteAria}
            className="hidden md:inline-flex text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            {deletePending ? a.deletePending : a.deleteForever}
          </button>
        )}
        {/* The deletion outcome is shown here on md and up only; below md StoryRow renders it on its own line. */}
        {message && <span role="alert" className={`text-[10px] text-red-500 text-right${error ? '' : ' hidden md:inline'}`}>{message}</span>}
      </div>
      {deletable && (
        <button
          ref={moreButtonRef}
          type="button"
          onClick={onToggleReveal}
          disabled={busy || deletePending}
          aria-expanded={revealed}
          aria-label={a.moreActions}
          title={a.moreActions}
          className="md:hidden inline-flex items-center justify-center min-h-11 min-w-11 -mr-2 rounded-lg text-gray-500 hover:text-oxford hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <span aria-hidden="true" className="text-xl leading-none">⋯</span>
        </button>
      )}
    </div>
  )
}
