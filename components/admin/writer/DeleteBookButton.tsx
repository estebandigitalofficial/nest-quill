'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteBookButton({ bookId }: { bookId: string }) {
  const [confirm, setConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/admin/writer/books/${bookId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (confirm) {
    return (
      <div className="flex gap-1 items-center relative z-10">
        <button
          onClick={e => { e.stopPropagation(); setConfirm(false) }}
          className="text-[11px] px-2.5 py-1 rounded-md border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={e => { e.stopPropagation(); handleDelete() }}
          disabled={deleting}
          className="text-[11px] px-2.5 py-1 rounded-md border border-red-900 text-red-400 hover:bg-red-950 disabled:opacity-50 transition-colors"
        >
          {deleting ? 'Deleting…' : 'Confirm'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setConfirm(true) }}
      className="text-[11px] px-2.5 py-1 rounded-md border border-gray-700 text-gray-600 hover:text-red-400 hover:border-red-900 transition-colors relative z-10"
    >
      Delete
    </button>
  )
}
