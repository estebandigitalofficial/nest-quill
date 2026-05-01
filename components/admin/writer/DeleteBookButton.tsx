'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteBookButton({ bookId, isOwner }: { bookId: string; isOwner: boolean }) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/admin/writer/books/${bookId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (!isOwner) {
    return (
      <span
        title="You can only delete your own books"
        className="text-xs px-3 py-1.5 sm:text-[11px] sm:px-2.5 sm:py-1 rounded-md border border-adm-border text-gray-700 cursor-not-allowed"
      >
        Delete
      </span>
    )
  }

  if (confirm) {
    return (
      <div className="flex gap-1 items-center relative z-10">
        <button
          onClick={e => { e.stopPropagation(); setConfirm(false) }}
          className="text-xs px-3 py-1.5 sm:text-[11px] sm:px-2.5 sm:py-1 rounded-md border border-adm-border text-adm-muted hover:text-adm-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={e => { e.stopPropagation(); handleDelete() }}
          disabled={deleting}
          className="text-xs px-3 py-1.5 sm:text-[11px] sm:px-2.5 sm:py-1 rounded-md border border-red-900 text-red-400 hover:bg-red-950 disabled:opacity-50 transition-colors"
        >
          {deleting ? 'Deleting…' : 'Confirm'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setConfirm(true) }}
      className="text-xs px-3 py-1.5 sm:text-[11px] sm:px-2.5 sm:py-1 rounded-md border border-adm-border text-adm-subtle hover:text-red-400 hover:border-red-900 transition-colors relative z-10"
    >
      Delete
    </button>
  )
}
