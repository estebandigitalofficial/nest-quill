'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const STATUS_OPTIONS = [
  { value: 'all',        label: 'All' },
  { value: 'complete',   label: 'Complete' },
  { value: 'processing', label: 'Processing' },
  { value: 'queued',     label: 'Queued' },
  { value: 'failed',     label: 'Failed' },
]

interface Props {
  q: string
  status: string
}

export default function LibraryFilters({ q, status }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const push = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v)
      else params.delete(k)
    }
    router.push(`/admin/library?${params.toString()}`)
  }, [router, searchParams])

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <form
        onSubmit={e => {
          e.preventDefault()
          const val = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim()
          push({ q: val, status: status === 'all' ? '' : status })
        }}
        className="flex gap-2 flex-1"
      >
        <input
          name="q"
          type="text"
          defaultValue={q}
          placeholder="Search by name, email, or request ID…"
          className="flex-1 bg-adm-surface border border-adm-border rounded-xl px-4 py-2.5 text-sm text-adm-text placeholder:text-adm-subtle focus:outline-none focus:border-gray-500 transition-colors"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-adm-surface hover:bg-adm-border border border-adm-border rounded-xl text-xs font-semibold text-adm-muted transition-colors whitespace-nowrap"
        >
          Search
        </button>
      </form>

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => push({ q, status: opt.value === 'all' ? '' : opt.value })}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              (status || 'all') === opt.value
                ? 'bg-brand-500 text-white'
                : 'bg-adm-surface text-adm-muted hover:bg-adm-border hover:text-adm-text border border-adm-border'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
