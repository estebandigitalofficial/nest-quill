'use client'

// Confirmation for permanently deleting an archived failed story (3C-4).
// The repository has no shared modal primitive (CookieBanner, GuideQuill and
// the admin menu each render their own role="dialog"), so this one follows
// the same shape and adds the focus handling a destructive dialog needs:
// focus lands on Cancel when it opens, Tab cycles inside, Escape cancels,
// the backdrop cancels, and nothing can be dismissed while the request is
// in flight (controls are disabled and the pending text is announced).
// The caller returns focus to the trigger after closing.

import { useEffect, useId, useRef } from 'react'
import { useLanguage } from '@/lib/i18n/context'

interface Props {
  open: boolean
  /** The DELETE request is in flight: every control is disabled. */
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function DeleteStoryDialog({ open, pending, onCancel, onConfirm }: Props) {
  const { t } = useLanguage()
  const a = t.account
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!pending) onCancel()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
        if (focusable.length === 0) { e.preventDefault(); return }
        const first = focusable[0], last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, pending, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-oxford/40 px-4"
      onClick={() => { if (!pending) onCancel() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-busy={pending || undefined}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-left"
      >
        <h2 id={titleId} className="font-serif text-lg text-oxford">{a.deleteTitle}</h2>
        <div id={descId} className="mt-3 space-y-2 text-sm leading-relaxed text-charcoal-light">
          <p>{a.deleteBody}</p>
          <p>{a.deleteFree}</p>
          <p>{a.deleteVsArchive}</p>
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm text-oxford">
          {pending ? a.deletePending : ''}
        </p>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-oxford hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            {a.deleteCancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {pending ? a.deletePending : a.deleteConfirm}
          </button>
        </div>
      </div>
    </div>
  )
}
